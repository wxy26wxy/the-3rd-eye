import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@/components/messages";
import { loadStoryTag } from "@/components/data";
import { StoryTagShell } from "@/components/storytag/Shell";
import { StoryTagView } from "@/components/storytag/StoryTagView";

export const metadata: Metadata = { title: m.tag.metaTitle, robots: { index: false } };

/**
 * Blocking on purpose: the page body waits for the existence check (no loading flash, and
 * notFound() renders the not-found page with noindex). Under Cache Components the layout shell
 * is still flushed first, so the HTTP status stays 200; a true 404 needs a lookup in proxy.ts.
 */
export const instant = false;

export default async function StoryTagPage({ params }: PageProps<"/t/[token]">) {
  const view = await loadStoryTag((await params).token);
  if (!view) notFound();
  return (
    <StoryTagShell>
      <StoryTagView view={view} />
    </StoryTagShell>
  );
}
