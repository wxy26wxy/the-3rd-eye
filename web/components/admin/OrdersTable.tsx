import Link from "next/link";
import { ORDER_STATUSES, listAdminOrders, type OrderStatus } from "@/lib/db/queries.contract";
import { setOrderStatus } from "@/app/admin/actions";
import { fmt, m, money } from "@/components/messages";
import { QrCode } from "@/components/qr/QrCode";
import { CopyButton } from "@/components/site/CopyButton";
import { siteOrigin, storyTagPath } from "@/components/site/origin";
import { Chip } from "@/components/ui/Text";
import styles from "./Admin.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: m.admin.statusPlaced, printing: m.admin.statusPrinting, shipped: m.admin.statusShipped, delivered: m.admin.statusDelivered,
};
const mediaHref = (pathname: string) => `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`;
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export async function OrdersTable() {
  const [orders, origin] = await Promise.all([listAdminOrders(), siteOrigin()]);
  if (orders.length === 0) return <p className={styles.empty}>{m.admin.empty}</p>;
  return (
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
            const url = o.token ? `${origin}${storyTagPath(o.token)}` : null;
            return (
              <tr key={o.id}>
                <th scope="row">
                  <span className={styles.mono}>{o.id.slice(0, 8)}</span>
                  <span className={styles.sub}>{dateFmt.format(o.createdAt)}</span>
                </th>
                <td>
                  <Chip tone={o.status === "delivered" ? "lime" : "cream"}>{STATUS_LABEL[o.status]}</Chip>
                  <form action={setOrderStatus} className={styles.statusForm}>
                    <input type="hidden" name="orderId" value={o.id} />
                    {ORDER_STATUSES.filter((s) => s !== o.status).map((s) => (
                      <button key={s} type="submit" name="status" value={s} className={styles.statusBtn}>
                        {fmt(m.admin.moveTo, { status: STATUS_LABEL[s] })}
                      </button>
                    ))}
                  </form>
                </td>
                <td>
                  <span className={styles.strong}>{o.buyerName}</span>
                  {o.buyerEmail ? <span className={styles.sub}>{o.buyerEmail}</span> : null}
                  {o.shipNote ? <span className={styles.sub}>“{o.shipNote}”</span> : null}
                </td>
                <td>
                  <Link href={`/p/${o.product.id}`} className={styles.strong}>{o.product.title}</Link>
                  <span className={styles.sub}>{o.product.type === "sticker" ? m.common.sticker : m.common.tote} · {fmt(m.common.by, { name: o.creator.displayName })}</span>
                  <Link href={`/admin/trace/${o.product.artworkId}`} className={styles.link}>{m.admin.trace}</Link>
                </td>
                <td><span className={styles.strong}>{money(o.creatorShareCents)}</span><span className={styles.sub}>{money(o.amountCents)}</span></td>
                <td>
                  {o.product.printPngUrl || o.product.printSvgUrl ? (
                    <ul role="list" className={styles.files}>
                      {o.product.printPngUrl ? <li><a href={mediaHref(o.product.printPngUrl)} className={styles.link} download>{m.admin.printPng}</a></li> : null}
                      {o.product.printSvgUrl ? <li><a href={mediaHref(o.product.printSvgUrl)} className={styles.link} download>{m.admin.dieSvg}</a></li> : null}
                    </ul>
                  ) : <span className={styles.sub}>{m.admin.noFiles}</span>}
                </td>
                <td>
                  {url && o.token ? (
                    <div className={styles.tag}>
                      <QrCode value={url} label={fmt(m.admin.qrLabel, { url })} />
                      <div className={styles.tagText}>
                        <Link href={storyTagPath(o.token)} className={styles.url}>{url}</Link>
                        <span className={styles.sub}>{fmt(m.admin.taps, { count: o.tapCount })}</span>
                        <CopyButton value={url} label={m.common.copy} copiedLabel={m.common.copied} />
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
  );
}
