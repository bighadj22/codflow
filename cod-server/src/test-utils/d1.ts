/**
 * A real D1 database for tests, built by replaying the actual migrations.
 *
 * The mock db in `mock-db.ts` maps a full-table `select()` positionally by
 * schema column order, which makes it useless for anything that reads across
 * two tables or depends on a real WHERE. Tests about precedence, joins, or
 * constraints must run against the real engine or they prove nothing.
 *
 * Each caller gets its own isolated database. Register the returned `dispose`
 * in `afterAll` — Miniflare holds a workerd process open until it is called.
 */
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";

const MIGRATIONS_DIR = resolve(__dirname, "../db/migrations");

/**
 * D1 caps how many statements one batch may carry, and the full migration set
 * is well past it — replay in chunks rather than one call.
 */
const BATCH_SIZE = 50;

function migrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return files.flatMap((file) =>
    readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((chunk) => chunk.split(/;\s*\n/))
      .map((statement) => statement.replace(/;+\s*$/, "").trim())
      // A chunk that is only comments has no statement in it.
      .filter((statement) => statement.replace(/--[^\n]*/g, "").trim().length > 0),
  );
}

export interface TestD1 {
  db: AppDb;
  raw: D1Database;
  dispose: () => Promise<void>;
}

export async function createTestD1(): Promise<TestD1> {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });

  const raw = await mf.getD1Database("DB");
  const prepared = migrationStatements().map((statement) => raw.prepare(statement));
  for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
    await raw.batch(prepared.slice(i, i + BATCH_SIZE));
  }

  return {
    db: drizzle(raw as unknown as D1Database, { schema }) as unknown as AppDb,
    raw,
    dispose: () => mf.dispose(),
  };
}
