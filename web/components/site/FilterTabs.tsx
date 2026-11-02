import Link from "next/link";
import type { ShopFilter } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { CheckIcon } from "@/components/ui/Icons";
import styles from "./FilterTabs.module.css";

const FILTERS: { key: ShopFilter; label: string }[] = [
  { key: "all", label: m.shop.filterAll },
  { key: "sticker", label: m.shop.filterStickers },
  { key: "tote", label: m.shop.filterTotes },
];

/**
 * Filter tabs (board 2010:570): 44 px pills, selected = ink fill + check. Links, so they work without
 * JavaScript; the active one carries aria-current. On phones the row scrolls sideways (ruling 4).
 */
export function FilterTabs({ active }: { active: ShopFilter }) {
  return (
    <nav aria-label={m.shop.filtersLabel} className={styles.nav}>
      <ul role="list" className={styles.list}>
        {FILTERS.map((f) => (
          <li key={f.key}>
            <Link
              href={f.key === "all" ? "/#collection" : `/?type=${f.key}#collection`}
              scroll={false}
              aria-current={active === f.key ? "page" : undefined}
              className={styles.tab}
            >
              {active === f.key ? <CheckIcon size="1rem" /> : null}
              {f.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
