/**
 * The open-weight stage: a story drafted from the creator's own words (story-video transcript)
 * with Muse Glimmer (Ollama on the development Mac; Muse Spark 1.3 fallback on Vercel). The
 * draft is stored on the creator and published only when they accept it.
 */
import "server-only";
import { ai } from "@/lib/ai/registry";
import { updateCreator, type CreatorRow } from "@/lib/db/queries";
import type { StoryDraftRecord } from "@/lib/db/schema";

export async function draftStoryFor(
  creatorId: string, transcript: string, opts: { mentionDisability: boolean; task?: string },
): Promise<{ draft: StoryDraftRecord; creator: CreatorRow | null }> {
  const out = await (await ai()).story.draftStory(transcript, {
    mentionDisability: opts.mentionDisability, trace: { stage: "story", task: opts.task ?? "T050", jobId: creatorId },
  });
  const draft: StoryDraftRecord = {
    headline: out.headline, bio_short: out.bio_short, story_text: out.story_text, provider: out.provider,
    mentionDisability: opts.mentionDisability, createdAt: new Date().toISOString(),
  };
  return { draft, creator: await updateCreator(creatorId, { storyDraft: draft }) };
}
