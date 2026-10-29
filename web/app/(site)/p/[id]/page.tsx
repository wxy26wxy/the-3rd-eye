import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@/components/messages";
import { loadProduct } from "@/components/data";
import { ProductView } from "@/components/product/ProductView";
import { Container } from "@/components/ui/Layout";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const p = await loadProduct((await params).id);
  return { title: p?.title ?? m.product.metaFallback, description: p?.description ?? undefined };
}

/**
 * Blocking on purpose: the page body waits for the existence check (no loading flash, and
 * notFound() renders the not-found page with noindex). Under Cache Components the layout shell
 * is still flushed first, so the HTTP status stays 200; a true 404 needs a lookup in proxy.ts.
 */
export const instant = false;

export default async function ProductPage({ params }: PageProps<"/p/[id]">) {
  const product = await loadProduct((await params).id);
  if (!product) notFound();
  return (
    <Container>
      <ProductView product={product} />
    </Container>
  );
}
