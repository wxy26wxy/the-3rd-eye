import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@/components/messages";
import { loadCreatorProfile } from "@/components/data";
import { CreatorProfile } from "@/components/pages/CreatorProfile";
import { Container } from "@/components/ui/Layout";
import styles from "@/components/pages/Pages.module.css";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const c = await loadCreatorProfile((await params).slug);
  return { title: c?.displayName ?? m.artists.metaTitle, description: c?.bioShort ?? undefined };
}

/**
 * Blocking on purpose: the page body waits for the existence check (no loading flash, and
 * notFound() renders the not-found page with noindex). Under Cache Components the layout shell
 * is still flushed first, so the HTTP status stays 200; a true 404 needs a lookup in proxy.ts.
 */
export const instant = false;

export default async function CreatorPage({ params }: PageProps<"/c/[slug]">) {
  const creator = await loadCreatorProfile((await params).slug);
  if (!creator) notFound();
  return (
    <Container className={styles.page}>
      <CreatorProfile creator={creator} />
    </Container>
  );
}
