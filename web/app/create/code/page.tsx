import { Suspense } from "react";
import { m } from "@/components/messages";
import { CodeSignIn } from "@/components/create/screens/CodeSignIn";
import { Loading } from "@/components/ui/Loading";

export default function Page({ searchParams }: PageProps<"/create/code">) {
  return (
    <Suspense fallback={<Loading label={m.common.loading} />}>
      <CodeSignIn searchParams={searchParams} />
    </Suspense>
  );
}
