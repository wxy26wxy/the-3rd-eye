import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run: vercel env pull .env.local --yes");
  return drizzle(neon(url), { schema });
}
let _db: ReturnType<typeof createDb> | null = null;
/** Lazy so `next build` succeeds before env vars exist. Never wrap in a Proxy. */
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
export type Db = ReturnType<typeof getDb>;
