import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
async function main() {
  const { storage } = await import("@/lib/storage");
  const [creatorId, ...files] = process.argv.slice(2);
  for (const f of files) {
    const [file, kind, type] = f.split(",");
    const ext = file.split(".").pop();
    const r = await storage().putPublic(`creators/${creatorId}/${kind}/${randomUUID()}.${ext}`, readFileSync(file), type);
    console.log(r.pathname);
  }
}
main();
