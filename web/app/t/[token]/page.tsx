import { Suspense } from "react";
import type { Metadata } from "next";
import { m } from "@/components/messages";
import { StoryTagShell } from "@/components/storytag/Shell";
import { StoryTagView } from "@/components/storytag/StoryTagView";
import { Loading } from "@/components/ui/Loading";

export const metadata: Metadata = { title: m.tag.metaTitle, robots: { index: false } };

export default function StoryTagPage({ params }: PageProps<"/t/[token]">) {
  return (
    <StoryTagShell>
      <Suspense fallback={<Loading label={m.common.loading} />}>
        <StoryTagView params={params} />
      </Suspense>
    </StoryTagShell>
  );
}
