import "server-only";
import type { Registry } from "../registry";
import { MetaCaptioner } from "./captions";
import { MetaDescriber } from "./describe";
import { MetaImageProvider } from "./image";
import { MetaListingAgent } from "./listing-agent";
import { MetaSegmenter } from "./sam";
import { MetaPromptShaper } from "./shape-prompt";
import { GlimmerStoryWriter } from "./story";
import { MetaTranscriber } from "./transcribe";
import { MetaNoteModerator } from "./moderate";
import { metaResponses } from "./client";

/** Live Meta providers. Clients are created on first call, so constructing this needs no keys. */
export function metaRegistry(opts: { story: "ollama" | "meta" }): Registry {
  const responses = metaResponses();
  return {
    transcribe: new MetaTranscriber(),
    shaper: new MetaPromptShaper(responses),
    image: new MetaImageProvider(responses),
    segmenter: new MetaSegmenter(),
    describer: new MetaDescriber(responses),
    listingAgent: new MetaListingAgent(responses),
    story: new GlimmerStoryWriter(opts.story),
    captioner: new MetaCaptioner(),
    moderator: new MetaNoteModerator(responses),
  };
}
