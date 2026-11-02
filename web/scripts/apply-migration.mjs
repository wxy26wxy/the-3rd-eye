// Applies one Drizzle SQL migration file to DATABASE_URL, statement by statement.
// Usage: pnpm exec dotenv -e .env.local -- node scripts/apply-migration.mjs drizzle/0003_t070_creators.sql
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

import { readdirSync } from "node:fs";
// Default: the newest file in drizzle/ (migrations are additive and idempotent).
const file =
  process.argv[2] ??
  "drizzle/" + readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort().at(-1);
console.log("migration:", file);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (run through dotenv -e .env.local)");
  process.exit(2);
}
const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(file, "utf8")
  .split(/-->\s*statement-breakpoint/)
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of statements) {
  await sql.query(statement);
  console.log("applied:", statement.split("\n")[0].slice(0, 80));
}
// Columns added by the additive migrations so far (0003 T070, 0004 T111, 0005 T121): each should say "yes".
for (const [table, column] of [["creators", "hidden"], ["artworks", "change_instruction"], ["orders", "size"], ["orders", "quantity"], ["products", "preview_url"]]) {
  const [{ n }] = await sql.query(
    "select count(*)::int n from information_schema.columns where table_name=$1 and column_name=$2",
    [table, column],
  );
  console.log(`${table}.${column} present:`, n === 1 ? "yes" : "no");
}
