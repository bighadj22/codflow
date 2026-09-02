#!/usr/bin/env node
/**
 * Security probe for the deployed CodFlow Astro dashboard (cod-client-astro).
 *
 * Non-destructive: probes the live app for open auth surfaces and header gaps.
 * Findings are asserted against the REAL deployed instance — no assumptions.
 *
 * Usage:
 *   DASH_URL=https://dashboard.example.com \
 *   API_URL=https://api.example.com \
 *   SMOKE_EMAIL=you@example.com \
 *   SMOKE_PASSWORD='...' \
 *   node scripts/security-probe.mjs
 *
 * Severity:
 *   PASS — control present / attack blocked
 *   WARN — hardening gap or unconfirmed surface (documented, not blocking)
 *   FAIL — actively exploitable/open surface (exit code 1)
 */
import { setTimeout as sleep } from "node:timers/promises";
const PACE = Number(process.env.PACE_MS ?? 400);

const DASH = (process.env.DASH_URL ?? "").replace(/\/+$/, "");
const API = (process.env.API_URL ?? "").replace(/\/+$/, "");
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

if (!DASH || !API || !EMAIL || !PASSWORD) {
  console.error(
    "Missing target. Set DASH_URL, API_URL, SMOKE_EMAIL and SMOKE_PASSWORD —\n" +
    "this probe is always pointed explicitly at the deployment under test:"
  );
  console.error(
    "  DASH_URL=https://dashboard.example.com API_URL=https://api.example.com \\\n" +
    "  SMOKE_EMAIL=you@example.com SMOKE_PASSWORD='...' node scripts/security-probe.mjs"
  );
  process.exit(2);
}

let pass = 0, fail = 0, warn = 0;
function report(sev, name, detail = "") {
  if (sev === "PASS") pass++;
  else if (sev === "WARN") warn++;
  else fail++;
  console.log(`  ${sev} ${name}${detail ? " — " + detail : ""}`);
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

console.log(`security-probe → dash=${DASH} api=${API}\n`);

// ── S1 — security headers on the dashboard shell ──────────────────────────
for (const p of ["/", "/sign-in/", "/orders/"]) {
  const res = await fetch(`${DASH}${p}`);
  const csp = res.headers.get("content-security-policy");
  const frame = res.headers.get("x-frame-options");
  const frameAncestors = csp?.includes("frame-ancestors");
  const nosniff = res.headers.get("x-content-type-options");
  const hsts = res.headers.get("strict-transport-security");
  const missing = [
    !csp && "CSP",
    !(frame || frameAncestors) && "frame-protection",
    !nosniff && "nosniff",
    !hsts && "HSTS",
  ].filter(Boolean);
  report(
    missing.length === 0 ? "PASS" : "WARN",
    `S1 headers ${p}`,
    missing.length === 0 ? "all present" : `missing: ${missing.join(", ")}`,
  );
}

// ── S2 — unauthenticated account registration ─────────────────────────────
{
  const email = `secprobe-${Date.now()}@codflow.test`;
  const res = await fetch(`${DASH}/api/auth/sign-up/email`, {
    method: "POST",
    headers: await j(),
    body: JSON.stringify({
      email,
      password: "SecProbe-9x!Temp",
      name: "Security Probe",
    }),
  });
  const status = res.status;
  const open = status === 200 || status === 201;
  report(
    open ? "FAIL" : "PASS",
    "S2 self-registration closed",
    open
      ? `OPEN — created ${email} (teardown needed)`
      : `status=${status}`,
  );
}

// ── S3 — OAuth dynamic client registration (unauthenticated) ──────────────
{
  const paths = [
    "/api/auth/register",
    "/api/auth/clients",
    "/api/auth/client/register",
    "/api/auth/register-client",
  ];
  let open = null;
  for (const p of paths) {
    const res = await fetch(`${DASH}${p}`, {
      method: "POST",
      headers: await j(),
      body: JSON.stringify({
        client_name: "Security Probe",
        redirect_uris: ["https://example.invalid/callback"],
        grant_types: ["authorization_code"],
        token_endpoint_auth_method: "client_secret_basic",
      }),
    });
    const body = await res.text().catch(() => "");
    if (res.status === 200 || res.status === 201) {
      open = p;
      break;
    }
  }
  report(
    open ? "FAIL" : "PASS",
    "S3 OAuth client registration closed",
    open ? `OPEN at ${open}` : "no open registration path found (404/401/4xx)",
  );
}

// ── S4 — OAuth consent page shipped? ──────────────────────────────────────
{
  const res = await fetch(`${DASH}/consent`);
  const status = res.status;
  report(
    status === 200 ? "PASS" : "WARN",
    "S4 OAuth consent page",
    status === 200 ? "served" : `status=${status} — auth config points to /consent but the route is missing`,
  );
}

// ── S5 — rate limiting holds on a sensitive endpoint ──────────────────────
{
  const email = `secprobe-${Date.now()}@codflow.test`;
  let saw429 = false;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${DASH}/api/auth/request-password-reset`, {
      method: "POST",
      headers: await j(),
      body: JSON.stringify({ email }),
    });
    if (res.status === 429) saw429 = true;
    await sleep(150);
  }
  report(
    saw429 ? "PASS" : "WARN",
    "S5 password-reset rate limit",
    saw429 ? "throttled (429 seen)" : "no 429 after 4 requests",
  );
}

// ── S6/S7 — API auth wall (orders) ────────────────────────────────────────
{
  const res = await fetch(`${API}/api/orders?limit=5`);
  report(res.status === 401 ? "PASS" : "FAIL", "S6 /api/orders unauthenticated → 401", `status=${res.status}`);
}
{
  const res = await fetch(`${API}/api/orders?limit=5`, {
    headers: { Authorization: "Bearer forged.token.value" },
  });
  report(res.status === 401 ? "PASS" : "FAIL", "S7 forged bearer → 401", `status=${res.status}`);
}

// ── S8 — real login + scoped orders access ────────────────────────────────
if (EMAIL && PASSWORD) {
  {
    const res = await fetch(`${DASH}/api/auth/sign-in/email`, {
      method: "POST",
      headers: await j(),
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    storeCookies(res);
    await sleep(PACE);
    const hasSession = [...jar.keys()].some(
      (k) => k.startsWith("better-auth") || k.includes("session_token"),
    );
    report(res.ok && hasSession ? "PASS" : "FAIL", "S8 sign-in", `status=${res.status}${hasSession ? "" : " no session cookie"}`);
  }

  let jwt = null;
  {
    await sleep(PACE);
    const res = await fetch(`${DASH}/api/auth/get-session`, { headers: await j() });
    const body = await res.json().catch(() => null);
    jwt = res.headers.get("set-auth-jwt");
    report(
      res.ok && !!body?.user && !!jwt ? "PASS" : "FAIL",
      "S8 get-session + set-auth-jwt",
      `status=${res.status}${jwt ? "" : " set-auth-jwt MISSING"}`,
    );
  }

  if (jwt) {
    const orders = await fetch(`${API}/api/orders?limit=50`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    report(
      orders.status === 200 ? "PASS" : "FAIL",
      "S8 authorized /api/orders → 200",
      `status=${orders.status}`,
    );
    const users = await fetch(`${API}/api/users`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    report(
      users.status === 403 ? "PASS" : "FAIL",
      "S8 staff JWT on admin wall /api/users → 403",
      `status=${users.status}`,
    );
  }
} else {
  console.log("  SKIP S8 (SMOKE_EMAIL / SMOKE_PASSWORD not set)");
}

console.log(`\n${pass} passed, ${warn} warnings, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
