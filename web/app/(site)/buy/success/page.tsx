import { Suspense } from "react";
import type { Metadata } from "next";
import { m } from "@/components/messages";
import { OrderSuccess } from "@/components/product/OrderSuccess";
import { Container } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";

export const metadata: Metadata = { title: m.success.metaTitle, robots: { index: false } };

export default function SuccessPage({ searchParams }: PageProps<"/buy/success">) {
  return (
    <Container width="narrow">
      <Suspense fallback={<Loading label={m.common.loading} />}>
        <OrderSuccess searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
