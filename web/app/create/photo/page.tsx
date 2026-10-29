import { Suspense } from "react";
import { m } from "@/components/messages";
import { Photo } from "@/components/create/screens/Photo";
import { Loading } from "@/components/ui/Loading";

async function PhotoWithMode({ searchParams }: { searchParams: PageProps<"/create/photo">["searchParams"] }) {
  const mode = (await searchParams).mode === "upload" ? "upload" : "camera";
  return <Photo mode={mode} />;
}

export default function Page({ searchParams }: PageProps<"/create/photo">) {
  return (
    <Suspense fallback={<Loading label={m.common.loading} />}>
      <PhotoWithMode searchParams={searchParams} />
    </Suspense>
  );
}
