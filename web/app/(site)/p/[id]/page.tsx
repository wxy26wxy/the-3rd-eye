import { Suspense } from "react";
import type { Metadata } from "next";
import { getProductDetail } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { ProductView } from "@/components/product/ProductView";
import { Container } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const p = await getProductDetail((await params).id);
  return { title: p?.title ?? m.product.metaFallback, description: p?.description ?? undefined };
}

export default function ProductPage({ params }: PageProps<"/p/[id]">) {
  return (
    <Container>
      <Suspense fallback={<Loading label={m.common.loading} />}>
        <ProductView params={params} />
      </Suspense>
    </Container>
  );
}
