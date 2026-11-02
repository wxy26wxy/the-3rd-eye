import { Suspense } from "react";
import { m } from "@/components/messages";
import { StoryVideo } from "@/components/create/screens/StoryVideo";
import { Loading } from "@/components/ui/Loading";

async function StoryVideoWithMode({ searchParams }: { searchParams: PageProps<"/create/story-video">["searchParams"] }) {
  // ?redo=1: "Record again" from My story video (Choose a product); saving returns there.
  return <StoryVideo redo={(await searchParams).redo === "1"} />;
}

export default function Page({ searchParams }: PageProps<"/create/story-video">) {
  return (
    <Suspense fallback={<Loading label={m.common.loading} />}>
      <StoryVideoWithMode searchParams={searchParams} />
    </Suspense>
  );
}
