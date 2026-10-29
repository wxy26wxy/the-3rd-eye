import { listShopProducts, type ShopFilter } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterTabs } from "@/components/site/FilterTabs";
import { Grid } from "@/components/ui/Layout";
import styles from "./Shop.module.css";

const VALID: ShopFilter[] = ["all", "sticker", "tote", "voice"];
export function parseFilter(v: string | string[] | undefined): ShopFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return VALID.includes(s as ShopFilter) ? (s as ShopFilter) : "all";
}

export async function Collection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseFilter((await searchParams).type);
  const products = await listShopProducts(filter);
  return (
    <>
      <FilterTabs active={filter} />
      {products.length === 0
        ? <p className={styles.empty}>{m.shop.empty}</p>
        : <Grid cols={4}>{products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</Grid>}
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
