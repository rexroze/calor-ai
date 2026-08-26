import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }
  return drizzle({ client: neon(url), schema });
}

/**
 * Lazily creates (and memoizes) the Drizzle client.
 * Safe to import at build time — nothing touches `process.env` until a query
 * actually runs.
 */
export function getDb(): Database {
  instance ??= createDb();
  return instance;
}

/**
 * Lazy proxy over the Drizzle client so `import { db } from "@/db"` never
 * throws at module-evaluation time (Next.js evaluates route/action modules
 * during builds even when they are never invoked).
 *
 * Note: neon-http does NOT support interactive transactions
 * (`db.transaction()` throws) — see notes in server actions that need
 * multi-statement writes.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const value = Reflect.get(getDb(), prop);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

export { schema };
