import { Suspense } from "react";
import { m } from "@/components/messages";
import { TraceView } from "@/components/admin/TraceView";
import { Display } from "@/components/ui/Display";
import { Loading } from "@/components/ui/Loading";

export default function TracePage({ params }: PageProps<"/admin/trace/[artworkId]">) {
  return (
    <>
      <Display as="h1" size="l">{m.admin.traceTitle}</Display>
      <Suspense fallback={<Loading label={m.common.loading} />}>
        <TraceView params={params} />
      </Suspense>
    </>
  );
}
