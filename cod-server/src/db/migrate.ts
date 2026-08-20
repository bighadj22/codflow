/**
 * Database Migration Runner
 *
 * Apply locally:  wrangler d1 migrations apply DB --local
 * Apply remotely: wrangler d1 migrations apply DB --remote
 */

import { drizzle } from "drizzle-orm/d1";
import { migrate } from "drizzle-orm/d1/migrator";
import * as schema from "./schema";

export async function runMigrations(d1: D1Database) {
  const db = drizzle(d1, { schema });
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
}
