import type { ReactNode } from "react";
import { listShopProducts, type ShopFilter } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterTabs } from "@/components/site/FilterTabs";
import styles from "./Shop.module.css";

const VALID: ShopFilter[] = ["all", "sticker", "tote"];
export function parseFilter(v: string | string[] | undefined): ShopFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return VALID.includes(s as ShopFilter) ? (s as ShopFilter) : "all";
}

/** Product grid: two Small cards per row on phones, Large cards four across from 64rem (boards 2018:1835 / 2018:2013). */
export function ProductGrid({ children }: { children: ReactNode }) {
  return <ul role="list" className={styles.grid}>{children}</ul>;
}

export async function Collection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseFilter((await searchParams).type);
  const products = await listShopProducts(filter);
  return (
    <>
      <FilterTabs active={filter} />
      {products.length === 0
        ? <p className={styles.empty}>{m.shop.empty}</p>
        : <ProductGrid>{products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ProductGrid>}
    </>
  );
}

export function CollectionFallback() {
  return (
    <>
      <FilterTabs active="all" />
      <p className={styles.empty} role="status">{m.common.loading}</p>
    </>
  );
}
