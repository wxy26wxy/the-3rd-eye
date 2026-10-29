import Link from "next/link";
import { getOrderConfirmation } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { siteOrigin, storyTagPath } from "@/components/site/origin";
import { CopyButton } from "@/components/site/CopyButton";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import styles from "./Success.module.css";

export async function OrderSuccess({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).order;
  const orderId = Array.isArray(raw) ? raw[0] : raw;
  const order = orderId ? await getOrderConfirmation(orderId) : null;
  if (!order) {
    return (
      <Card pad="l" className={styles.card}>
        <p>{m.success.missing}</p>
        <Button href="/">{m.success.keepShopping}</Button>
      </Card>
    );
  }
  const url = `${await siteOrigin()}${storyTagPath(order.token)}`;
  return (
    <div className={styles.wrap}>
      <Tag pose="cheering" />
      <Display as="h1" size="xl">{m.success.title}</Display>
      <Card pad="l" className={styles.card}>
        <p className={styles.notified} role="status">{fmt(m.success.notified, { creator: order.creatorName })}</p>
        <p>{fmt(m.success.copy, { title: order.productTitle })}</p>
        <p className={styles.urlLabel} id="tag-url-label">{m.success.tagLabel}</p>
        <p className={styles.url} aria-labelledby="tag-url-label"><Link href={storyTagPath(order.token)}>{url}</Link></p>
        <div className={styles.actions}>
          <CopyButton value={url} label={m.common.copy} copiedLabel={m.common.copied} />
          <Button href={storyTagPath(order.token)}>{m.success.openTag}</Button>
        </div>
      </Card>
      <Button href="/" variant="ghost" arrow={false}>{m.success.keepShopping}</Button>
    </div>
  );
}
