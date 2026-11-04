/**
 * Uploads a creator's story video recorded outside the app (T151, round 7) and captions it the way
 * `POST /creators/me/story-video` does; see lib/pipeline/story-video.ts. Needs `ffprobe` and `ffmpeg`
 * on the PATH. Prints the slug, the duration, the stored pathname, the first two caption cues and
 * whether a story draft was made (never env values or creator codes). The previous video stays in
 * storage (write-once).
 *   pnpm story-video <slug> <file.mp4> [--mention-disability]   # uploads, captions, writes, drafts
 *   pnpm story-video <slug> <file.mp4> --dry-run                # checks, WAV, captions only; prints the transcript
 */
async function main() {
  const { parseStoryVideoArgs, storyVideo, wavArgs, ffprobeArgs, STORY_VIDEO_KIND, USAGE } = await import("@/lib/pipeline/story-video");
  let args;
  try {
    args = parseStoryVideoArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error(USAGE);
    process.exit(2);
  }
  // A dry run must not reach the database: without DATABASE_URL the model-call trace is not persisted either.
  if (args.dryRun) delete process.env.DATABASE_URL;
  const path = await import("node:path");
  const os = await import("node:os");
  const { execFile } = await import("node:child_process");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  // A relative file is read from where the command was typed (pnpm runs this script from web/).
  const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), args.file);

  const run = (cmd: string, argv: string[]) => new Promise<string>((resolve, reject) => {
    execFile(cmd, argv, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === "ENOENT") reject(new Error(`${cmd} not found: install ffmpeg (for example \`brew install ffmpeg\`) and try again`));
      else if (err) reject(new Error(`${cmd} failed: ${String(stderr).trim().split("\n").pop() || err.message}`));
      else resolve(String(stdout));
    });
  });

  await storyVideo({
    probe: (f) => run("ffprobe", ffprobeArgs(f)),
    extractWav: async (f) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "story-video-"));
      try {
        const out = path.join(dir, "story.wav");
        await run("ffmpeg", wavArgs(f, out));
        return await readFile(out);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    readFile: (f) => readFile(f),
    findCreator: async (slug) => (await import("@/lib/db/queries")).getCreatorBySlug(slug),
    putVideo: async (creatorId, mp4) => {
      const { storage, creatorPath } = await import("@/lib/storage");
      return (await storage().putPrivate(creatorPath(creatorId, STORY_VIDEO_KIND, "mp4"), mp4, "video/mp4")).pathname;
    },
    caption: async (wav, jobId) => {
      const { ai } = await import("@/lib/ai/registry");
      return (await ai()).captioner.caption(wav, { filename: "story.wav", trace: { stage: "captions", task: "T151", jobId } });
    },
    update: async (creatorId, patch) => (await import("@/lib/db/queries")).updateCreator(creatorId, patch),
    draft: async (creatorId, transcript, opts) => (await import("@/lib/pipeline/story")).draftStoryFor(creatorId, transcript, { ...opts, task: "T151" }),
    log: (line) => console.log(line),
    warn: (line) => console.warn(line),
  }, { ...args, file });
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

export {}; // a module, so main() does not clash with the other scripts in the type check
