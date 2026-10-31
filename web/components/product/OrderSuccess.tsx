import Link from "next/link";
import { getOrderConfirmation } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { siteOrigin, storyTagPath } from "@/components/site/origin";
import { CopyButton } from "@/components/site/CopyButton";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { SkyCard } from "@/components/ui/Loading";
import styles from "./Success.module.css";

/**
 * Order success (board 2019:2189): one white card with the sky picture (decorative), Thank you!,
 * who was notified, the story tag link row with Copy, Open the story tag, Keep shopping.
 * Missing order: the same card with only the heading and Keep shopping.
 */
export async function OrderSuccess({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).order;
  const orderId = Array.isArray(raw) ? raw[0] : raw;
  const order = orderId ? await getOrderConfirmation(orderId) : null;
  if (!order) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <Display as="h1" size="l">{m.success.missing}</Display>
          <Button href="/">{m.success.keepShopping}</Button>
        </div>
      </div>
    );
  }
  const url = `${await siteOrigin()}${storyTagPath(order.token)}`;
  const shown = url.replace(/^https?:\/\//, "");
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <SkyCard className={styles.sky} />
        <Display as="h1" size="xl">{m.success.title}</Display>
        <p className={styles.notified} role="status">{fmt(m.success.notified, { creator: order.creatorName })}</p>
        <p className={styles.copy}>{fmt(m.success.copy, { title: order.productTitle })}</p>
        <div className={styles.linkBlock}>
          <p className={styles.urlLabel} id="tag-url-label">{m.success.tagLabel}</p>
          <div className={styles.linkRow}>
            <Link href={storyTagPath(order.token)} className={styles.url} aria-describedby="tag-url-label">{shown}</Link>
            <CopyButton value={url} label={m.common.copy} copiedLabel={m.common.copied} className={styles.copyBtn} />
          </div>
        </div>
        <Button href={storyTagPath(order.token)} block>{m.success.openTag}</Button>
        <Button href="/" variant="secondary" arrow={false} block>{m.success.keepShopping}</Button>
      </div>
    </div>
  );
}
