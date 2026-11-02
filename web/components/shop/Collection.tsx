import type { ReactNode } from "react";
import Link from "next/link";
import { listShopProducts, type ShopFilter } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { ProductCard, toneAt } from "@/components/site/ProductCard";
import { FilterTabs } from "@/components/site/FilterTabs";
import { Display } from "@/components/ui/Display";
import styles from "./Shop.module.css";

/** New this week shows two rows of four (2018:1835); "View all" shows the rest. */
export const FIRST_PAGE = 8;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const VALID: ShopFilter[] = ["all", "sticker", "tote"];
export function parseFilter(v: string | string[] | undefined): ShopFilter {
  const s = first(v);
  return VALID.includes(s as ShopFilter) ? (s as ShopFilter) : "all";
}

/** Product grid: two tiles per row on phones, four from 64rem (2018:1835, 24 px gaps, 28 px between rows). */
export function ProductGrid({ children }: { children: ReactNode }) {
  return <ul role="list" className={styles.grid}>{children}</ul>;
}

/** Filters, then the "New this week" header row with View all (annotation order on 2018:1789). */
function Header({ filter, viewAllHref }: { filter: ShopFilter; viewAllHref?: string | null }) {
  return (
    <>
      <FilterTabs active={filter} />
      <div className={styles.headerRow}>
        <Display id="collection-title" size="l">{m.shop.collectionTitle}</Display>
        {viewAllHref ? <Link href={viewAllHref} scroll={false} className={styles.textAction}>{m.shop.viewAll}<span aria-hidden="true"> →</span></Link> : null}
      </div>
    </>
  );
}

export async function Collection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filter = parseFilter(params.type);
  const all = first(params.view) === "all";
  const products = await listShopProducts(filter);
  const shown = all ? products : products.slice(0, FIRST_PAGE);
  const viewAllHref = !all && products.length > FIRST_PAGE
    ? `/?${filter === "all" ? "" : `type=${filter}&`}view=all#collection`
    : null;
  return (
    <>
      <Header filter={filter} viewAllHref={viewAllHref} />
      {shown.length === 0
        ? <p className={styles.empty}>{m.shop.empty}</p>
        : <ProductGrid>{shown.map((p, i) => <li key={p.id}><ProductCard product={p} tone={toneAt(i)} /></li>)}</ProductGrid>}
    </>
  );
}

export function CollectionFallback() {
  return (
    <>
      <Header filter="all" />
      <p className={styles.empty} role="status">{m.common.loading}</p>
    </>
  );
}
