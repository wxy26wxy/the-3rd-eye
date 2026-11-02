/**
 * Live probe: one tiny call per model, prints the exact response shapes (long strings
 * elided), and writes fixtures under web/test/fixtures/<stage>/.
 * Run from the repo root:
 *   pnpm --filter web exec dotenv -e .env.local -- tsx ../scripts/probe_meta.ts [stage ...]
 * Stages: transcribe spark image edit sam ollama (default: all but edit). Never prints the key.
 * `edit` (T111) records test/fixtures/edit/probe-edit.json: one Muse Image edit of the generate probe PNG,
 * the response kept whole except the image, which is re-encoded at 128 px so the fixture stays small.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const WEB = process.cwd(); // pnpm --filter web exec runs in web/
const requireWeb = createRequire(join(WEB, "package.json"));
const sharp = requireWeb("sharp") as typeof import("sharp");
const FIXTURES = join(WEB, "test/fixtures");
const BASE = "https://api.meta.ai/v1";
const KEY = process.env.META_API_KEY;
const OLLAMA = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

function shape(v: unknown, depth = 0): unknown {
  if (depth > 10) return "…";
  if (typeof v === "string") return v.length > 160 ? `<string len=${v.length} head=${JSON.stringify(v.slice(0, 60))}>` : v;
  if (Array.isArray(v)) return v.slice(0, 8).map((x) => shape(x, depth + 1)).concat(v.length > 8 ? [`…+${v.length - 8}`] : []);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, depth + 1)]));
  return v;
}
function show(label: string, v: unknown) {
  console.log(`\n=== ${label} ===\n${JSON.stringify(shape(v), null, 2)}`);
}
function save(stage: string, name: string, data: string | Buffer) {
  mkdirSync(join(FIXTURES, stage), { recursive: true });
  writeFileSync(join(FIXTURES, stage, name), data);
  console.log(`  wrote test/fixtures/${stage}/${name}`);
}
const auth = () => ({ Authorization: `Bearer ${KEY}` });

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = text;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, json };
}

function silentWav(seconds = 1, rate = 16000): Buffer {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 3000), 44 + i * 2);
  return buf;
}

async function probeTranscribe() {
  // Verified shape: parts `request` (JSON) + `audio`; audioEncoding "WAV" is the only accepted value.
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV" })], { type: "application/json" }));
  form.append("audio", new Blob([new Uint8Array(silentWav())], { type: "audio/wav" }), "probe.wav");
  const res = await fetch(`${BASE}/asr/transcribe`, { method: "POST", headers: auth(), body: form });
  const text = await res.text();
  let json: unknown = text; try { json = JSON.parse(text); } catch { /* text */ }
  show(`transcribe → ${res.status}`, json);
  save("transcribe", "probe.json", JSON.stringify({ status: res.status, body: json }, null, 2));
}

async function probeSpark() {
  const r = await postJson("/responses", {
    model: "muse-spark-1.3",
    input: "Reply with a JSON object: a one-word color for the sky.",
    reasoning: { effort: "low" },
    text: { format: { type: "json_schema", name: "probe", strict: true, schema: { type: "object", additionalProperties: false, properties: { color: { type: "string" } }, required: ["color"] } } },
  });
  show(`spark → ${r.status}`, r.json);
  save("spark", "probe.json", JSON.stringify(r, null, 2));
}

async function probeImage() {
  const prompt = "A small red circle sticker with a bold black outline on a pure white background, flat colors.";
  const variants: [string, Record<string, unknown>][] = [
    ["with-tool", { model: "muse-image-1.0", input: prompt, tools: [{ type: "image_generation", output_format: "png", size: "1024x1024" }] }],
    ["no-tool", { model: "muse-image-1.0", input: prompt }],
  ];
  for (const [name, body] of variants) {
    const r = await postJson("/responses", body);
    show(`image ${name} → ${r.status}`, r.json);
    const out = (r.json as { output?: { type?: string; result?: string }[] })?.output ?? [];
    const item = out.find((o) => typeof o.result === "string" && o.result.length > 100);
    save("generate", `probe-${name}.json`, JSON.stringify(shape(r), null, 2));
    if (r.status === 200 && item?.result) {
      const png = Buffer.from(item.result, "base64");
      const meta = await sharp(png).metadata();
      console.log(`  image ${name}: ${meta.format} ${meta.width}x${meta.height}, ${png.length} bytes`);
      save("generate", "probe.png", await sharp(png).resize(256, 256).png().toBuffer()); // small copy; native size printed above
      return;
    }
  }
}

async function probeEdit() {
  // Same body as MetaImageProvider.edit (web/lib/ai/meta/image.ts#editBody).
  const { readFileSync } = await import("node:fs");
  const input = readFileSync(join(FIXTURES, "generate", "probe.png"));
  const guard = "Keep the same subject, style and pure white background unless asked otherwise.";
  const instruction = "Make the circle blue.";
  const body = {
    model: "muse-image-1.0",
    input: [{ role: "user", content: [
      { type: "input_text", text: `${instruction}\n${guard}` },
      { type: "input_image", image_url: `data:image/png;base64,${input.toString("base64")}`, detail: "auto" },
    ] }],
    tools: [{ type: "image_generation", output_format: "png", size: "1024x1024" }],
  };
  const r = await postJson("/responses", body);
  show(`edit → ${r.status}`, r.json);
  const json = r.json as { output?: { type?: string; result?: string }[] };
  const item = json?.output?.find((o) => o.type === "image_generation_call" && typeof o.result === "string" && o.result.length > 100);
  if (r.status === 200 && item?.result) {
    const full = Buffer.from(item.result, "base64");
    const meta = await sharp(full).metadata();
    console.log(`  edit: ${meta.format} ${meta.width}x${meta.height}, ${full.length} bytes`);
    const small = await sharp(full).resize(128, 128).png().toBuffer();
    item.result = small.toString("base64");
    (item as { id?: string }).id = "ig_redacted"; // opaque handle to the hosted image; not needed by the parser
    save("edit", "probe-edit.png", small);
  }
  const request = { ...body, input: [{ role: "user", content: [body.input[0].content[0], { type: "input_image", image_url: "<data:image/png;base64 of test/fixtures/generate/probe.png>", detail: "auto" }] }] };
  save("edit", "probe-edit.json", JSON.stringify({ status: r.status, request, response: json }, null, 2));
}

async function probeSam() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="128" r="60" fill="#000"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const body = {
    model: "sam-3.1", stream: true, metadata: { include_confidence: "true" },
    input: [{ role: "user", content: [{ type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` }, { type: "input_text", text: "black circle" }] }],
  };
  const res = await fetch(`${BASE}/responses`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  console.log(`\n=== sam → ${res.status} ${res.headers.get("content-type")} ===`);
  const raw = await res.text();
  const events: { type: string }[] = [];
  for (const block of raw.split(/\n\n/)) {
    const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
    if (!data || data === "[DONE]") continue;
    try { events.push(JSON.parse(data)); } catch { console.log("  unparsed:", data.slice(0, 120)); }
  }
  console.log("  event types:", events.map((e) => e.type).join(", ") || raw.slice(0, 400));
  save("segment", "probe-events.json", JSON.stringify(events, null, 2));
  const parser = await import(pathToFileURL(join(WEB, "node_modules/@meta-sam/parser/dist/index.js")).href);
  async function* gen() { for (const e of events) yield e; }
  try {
    const result = await parser.parseImageStream(gen()).finalResult;
    show("sam parsed", { outcome: result.outcome, records: result.records.map((r: { kind: string }) => r), diagnostics: result.diagnostics });
  } catch (err) {
    console.log("  parser error:", (err as Error).message);
  }
}

async function probeOllama() {
  try {
    const res = await fetch(`${OLLAMA}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ollama" },
      body: JSON.stringify({ model: "muse-glimmer", response_format: { type: "json_object" }, messages: [{ role: "system", content: 'Reply as JSON {"ok": true}' }, { role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(60_000),
    });
    const json = await res.json();
    show(`ollama → ${res.status}`, json);
    save("story", "probe-ollama.json", JSON.stringify(json, null, 2));
  } catch (err) {
    console.log(`\n=== ollama unreachable at ${OLLAMA}: ${(err as Error).message} ===`);
  }
}

async function main() {
  const all: Record<string, () => Promise<void>> = { transcribe: probeTranscribe, spark: probeSpark, image: probeImage, edit: probeEdit, sam: probeSam, ollama: probeOllama };
  const wanted = process.argv.slice(2).filter((a) => a in all);
  const stages = wanted.length ? wanted : Object.keys(all).filter((s) => s !== "edit");
  if (!KEY && stages.some((s) => s !== "ollama")) {
    console.log("META_API_KEY is not set; only the ollama probe can run.");
    if (stages.includes("ollama")) await probeOllama();
    return;
  }
  for (const s of stages) {
    try { await all[s](); } catch (err) { console.log(`\n=== ${s} failed: ${(err as Error).message} ===`); }
  }
}

main();
