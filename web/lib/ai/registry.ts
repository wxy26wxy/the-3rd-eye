import "server-only";
import type { TranscribeProvider, PromptShaper, ImageProvider, Segmenter, Describer, ListingAgent, StoryWriter, Captioner } from "./types";

/**
 * The only place that knows about concrete providers. Selection by env:
 *   AI_FIXTURES=1   → synthetic offline providers (no keys, no network; see lib/ai/fixtures.ts)
 *   AI_STORY=ollama|meta (default ollama)
 * Implementations are loaded lazily so unused providers cost nothing at build time.
 */
export type Registry = {
  transcribe: TranscribeProvider; shaper: PromptShaper; image: ImageProvider; segmenter: Segmenter;
  describer: Describer; listingAgent: ListingAgent; story: StoryWriter; captioner: Captioner;
};

let _registry: Registry | null = null;
export async function ai(): Promise<Registry> {
  if (_registry) return _registry;
  if (process.env.AI_FIXTURES === "1") {
    const f = await import("./fixtures");
    _registry = f.fixtureRegistry();
    return _registry;
  }
  const meta = await import("./meta");
  _registry = meta.metaRegistry({ story: process.env.AI_STORY === "meta" ? "meta" : "ollama" });
  return _registry;
}
