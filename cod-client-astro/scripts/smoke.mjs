#!/usr/bin/env node
/**
 * P1 smoke gates for the Astro dashboard + cod-server bearer contract.
 * Usage (defaults target local dev — dashboard :4321, cod-server :8787):
 *   DASH_URL=https://dashboard.example.com \
 *   API_URL=https://api.example.com \
 *   SMOKE_EMAIL=sectest-smoke@codflow.test \
 *   SMOKE_PASSWORD='...' \
 *   node scripts/smoke.mjs
 */
import { setTimeout as sleep } from "node:timers/promises";
const PACE = Number(process.env.PACE_MS ?? 400);

const DASH = (process.env.DASH_URL ?? "http://localhost:4321").replace(/\/+$/, "");
const API = (process.env.API_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

let pass = 0, fail = 0;
function gate(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else    { fail++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
}
const jar = new Map();
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair, ...attrs] = c.split(";");
    const eqi = pair.indexOf("=");
    const name = pair.slice(0, eqi).trim();
    let value = pair.slice(eqi + 1).trim();
    if (attrs.some((a) => a.trim().startsWith("Expires=Thu, 01 Jan 1970"))) value = "";
    jar.set(name, value);
  }
}

async function j(origin = DASH) {
  return {
    "Content-Type": "application/json",
    origin,
    ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
  };
}

console.log(`smoke → dash=${DASH} api=${API}\n`);

// G1 — orders shell: gate marker present + zero data
{
  const res = await fetch(`${DASH}/orders`);
  const html = await res.text();
  const gated = html.includes('data-auth-gate="required"');
  const leaky = /ORD-\d{4,}|\b[05-9]\d{8,}\b|[\w.+-]+@[\w-]+\.[\w.]+/.test(html.replace(/codflow\.store|example\.com/g, ""));
  gate("G1 orders shell: gate shipped & carries no data", res.status === 200 && gated && !leaky,
    `status=${res.status}${gated ? "" : " | NO GATE MARKER"}${leaky ? " LEAK DETECTED" : ""}`);
}

// G10 — sign-in reverse gate marker (authed visitors get bounced out)
{
  const res = await fetch(`${DASH}/sign-in`);
  const html = await res.text();
  gate("G10 sign-in shell: reverse gate shipped", res.status === 200 && html.includes('data-auth-gate="reverse"'));
}

// G11 — anonymous get-session returns JSON null (gate input path)
{
  const res = await fetch(`${DASH}/api/auth/get-session`);
  const body = await res.json().catch(() => undefined);
  gate("G11 anonymous get-session → JSON null", res.status === 200 && body === null);
}

// G2 — API rejects unauthenticated
{
  const res = await fetch(`${API}/api/orders?limit=5`);
  gate("G2 /api/orders unauthenticated → 401", res.status === 401, `status=${res.status}`);
}

// G3 — forged bearer rejected
{
  const res = await fetch(`${API}/api/orders?limit=5`, {
    headers: { Authorization: "Bearer forged.token.value" },
  });
  gate("G3 forged bearer → 401", res.status === 401, `status=${res.status}`);
}

// G8 first half — wrong password (before real login so cookie state is clean)
if (EMAIL && PASSWORD) {
  const res = await fetch(`${DASH}/api/auth/sign-in/email`, {
    method: "POST",
    headers: await j(),
    body: JSON.stringify({ email: EMAIL, password: "definitely-wrong-password" }),
  });
  storeCookies(res);
  await sleep(PACE);
  gate("G8 wrong password rejected cleanly", [400, 401].includes(res.status), `status=${res.status}`);
}

// G4 — sign in
let sessionUser = null;
{
  const res = await fetch(`${DASH}/api/auth/sign-in/email`, {
    method: "POST",
    headers: await j(),
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  storeCookies(res);
  await sleep(PACE);
  try { sessionUser = (await res.json())?.user ?? null; } catch {}
  gate("G4 sign-in", res.ok && !!sessionUser && jarHasSession(), `status=${res.status}`);
}
function jarHasSession() {
  return [...jar.keys()].some((k) => k.startsWith("better-auth") || k.includes("session_token"));
}

// G5 — get-session returns identity + set-auth-jwt
let jwt = null;
{
  await sleep(PACE);
  const res = await fetch(`${DASH}/api/auth/get-session`, { headers: await j() });
  const body = await res.json().catch(() => null);
  jwt = res.headers.get("set-auth-jwt");
  gate(
    "G5 get-session + set-auth-jwt",
    res.ok && !!body?.user && !!jwt,
    `status=${res.status}${jwt ? "" : " | set-auth-jwt MISSING"}`
  );
}

// G6/G7 — authorized orders fetch + money invariant
{
  const res = await fetch(`${API}/api/orders?limit=50`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const body = await res.json().catch(() => null);
  const rows = body?.data ?? [];
  gate("G6 /api/orders with Bearer → 200 + rows", res.status === 200 && Array.isArray(rows), `status=${res.status} rows=${rows.length}`);
  if (rows.length > 0) {
    const o = rows[0];
    const invariant = Math.abs(o.codAmount - (o.price + o.deliveryFee)) < 0.001;
    gate("G7 money invariant codAmount === price + deliveryFee", invariant, `${o.orderNumber}: ${o.price}+${o.deliveryFee}=${o.codAmount}`);
  } else {
    console.log("  SKIP G7 (no rows to assert)");
  }
}

// G9 — admin wall holds for scoped staff JWT
if (jwt) {
  const res = await fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${jwt}` } });
  gate("G9 staff JWT on /api/users → 403", res.status === 403, `status=${res.status}`);
}

// G8 second half — wrong password AFTER login must also be clean
if (EMAIL) {
  const res = await fetch(`${DASH}/api/auth/sign-in/email`, {
    method: "POST",
    headers: await j(),
    body: JSON.stringify({ email: EMAIL, password: "wrong-again" }),
  });
  gate("G8b post-login wrong password still rejected", [400, 401].includes(res.status), `status=${res.status}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
