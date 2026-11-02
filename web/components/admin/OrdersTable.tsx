import Link from "next/link";
import { ORDER_STATUSES, listAdminOrders, type OrderStatus } from "@/lib/db/queries.contract";
import { setOrderStatus } from "@/app/admin/actions";
import { fmt, m, money } from "@/components/messages";
import { QrCode } from "@/components/qr/QrCode";
import { CopyButton } from "@/components/site/CopyButton";
import { siteOrigin, storyTagPath } from "@/components/site/origin";
import { Chip } from "@/components/ui/Text";
import { SIZES, type SizeKey } from "@/lib/products/sizes";
import { StatusButtons } from "./StatusButtons";
import styles from "./Admin.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: m.admin.statusPlaced, printing: m.admin.statusPrinting, shipped: m.admin.statusShipped, delivered: m.admin.statusDelivered,
};
const mediaHref = (pathname: string) => `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`;
const SIZE_LABEL = m.product.sizes as Record<SizeKey, string>;
const addOf = (key: SizeKey) => SIZES.sticker.find((o) => o.key === key)?.addCents ?? 0;
/** "4 in × 2" for a sized line, "× 2" without a size (totes, orders before v0.8). */
export function sizeQty(o: { size: string | null; quantity: number }): string {
  const label = o.size ? SIZE_LABEL[o.size as SizeKey] ?? o.size : null;
  return label ? fmt(m.admin.sizeQty, { size: label, quantity: o.quantity }) : fmt(m.admin.qtyOnly, { quantity: o.quantity });
}
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * Orders table (board 2031:3895, fixed r4): order + date; status chip and "Mark {status}" pills; buyer;
 * product with type line, ship note, notes and the AI trace link; creator share; print files; story tag
 * cell = 120 px QR, /t/{token} link, "{n} taps" and Copy. T111: "size × qty" under the product, sample pricing note.
 */
export async function OrdersTable() {
  const [orders, origin] = await Promise.all([listAdminOrders(), siteOrigin()]);
  if (orders.length === 0) return <p className={styles.empty}>{m.admin.empty}</p>;
  return (
    <>
      <p className={styles.sub}>{fmt(m.admin.samplePricing, { four: money(addOf("4in")), sheet: money(addOf("sheet")) })}</p>
      <div className={styles.scroll} role="region" aria-labelledby="orders-title" tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{m.admin.colOrder}</th>
              <th scope="col">{m.admin.colStatus}</th>
              <th scope="col">{m.admin.colBuyer}</th>
              <th scope="col">{m.admin.colProduct}</th>
              <th scope="col">{m.admin.colShare}</th>
              <th scope="col">{m.admin.colFiles}</th>
              <th scope="col">{m.admin.colTag}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const path = o.token ? storyTagPath(o.token) : null;
              const url = path ? `${origin}${path}` : null;
              return (
                <tr key={o.id}>
                  <th scope="row">
                    <span className={styles.strong}>{o.id.slice(0, 8)}</span>
                    <span className={styles.sub}>{dateFmt.format(o.createdAt)}</span>
                  </th>
                  <td className={styles.statusCell}>
                    <Chip tone={o.status === "delivered" ? "lime" : "cream"}>{STATUS_LABEL[o.status]}</Chip>
                    <StatusButtons action={setOrderStatus} orderId={o.id} current={o.status} statuses={ORDER_STATUSES} labels={STATUS_LABEL} />
                  </td>
                  <td>
                    <span>{o.buyerName}</span>
                    {o.buyerEmail ? <span className={styles.sub}>{o.buyerEmail}</span> : null}
                  </td>
                  <td className={styles.productCell}>
                    <Link href={`/p/${o.product.id}`} className={styles.title}>{o.product.title}</Link>
                    <span className={styles.sub}>{o.product.type === "sticker" ? m.common.sticker : m.common.tote}{m.common.listSeparator}{fmt(m.common.by, { name: o.creator.displayName })}</span>
                    <span className={styles.sub}>{sizeQty(o)}</span>
                    {o.shipNote ? <span className={styles.note}>“{o.shipNote}”</span> : null}
                    {o.messages.length ? (
                      <ul role="list" aria-label={m.admin.notesLabel} className={styles.notes}>
                        {o.messages.map((msg) => (
                          <li key={msg.id}>
                            {msg.direction === "buyer_to_creator" ? m.admin.noteFromBuyer : m.admin.noteFromCreator}: “{msg.body}”
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Link href={`/admin/trace/${o.product.artworkId}`} className={styles.link}>{m.admin.trace}</Link>
                  </td>
                  <td><span>{money(o.creatorShareCents)}</span><span className={styles.sub}>{money(o.amountCents)}</span></td>
                  <td>
                    {o.product.printPngUrl || o.product.printSvgUrl ? (
                      <ul role="list" className={styles.files}>
                        {o.product.printPngUrl ? <li><a href={mediaHref(o.product.printPngUrl)} className={styles.link} download>{m.admin.printPng}</a></li> : null}
                        {o.product.printSvgUrl ? <li><a href={mediaHref(o.product.printSvgUrl)} className={styles.link} download>{m.admin.dieSvg}</a></li> : null}
                      </ul>
                    ) : <span className={styles.muted}>{m.admin.noFiles}</span>}
                  </td>
                  <td>
                    {url && path ? (
                      <div className={styles.tag}>
                        <QrCode value={url} label={fmt(m.admin.qrLabel, { url })} className={styles.tagQr} />
                        <Link href={path} className={styles.link}>{path}</Link>
                        <div className={styles.taps}>
                          <span>{fmt(m.admin.taps, { count: o.tapCount })}</span>
                          <CopyButton value={url} label={m.common.copy} copiedLabel={m.common.copied} className={styles.copySmall} />
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
