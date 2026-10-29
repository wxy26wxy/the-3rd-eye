import Link from "next/link";
import type { ShopFilter } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import styles from "./FilterTabs.module.css";

const FILTERS: { key: ShopFilter; label: string }[] = [
  { key: "all", label: m.shop.filterAll },
  { key: "sticker", label: m.shop.filterStickers },
  { key: "tote", label: m.shop.filterTotes },
  { key: "voice", label: m.shop.filterVoice },
];

/** Filter links (work without JavaScript). The active one carries aria-current. */
export function FilterTabs({ active }: { active: ShopFilter }) {
  return (
    <nav aria-label={m.shop.filtersLabel}>
      <ul role="list" className={styles.list}>
        {FILTERS.map((f) => (
          <li key={f.key}>
            <Link
              href={f.key === "all" ? "/#collection" : `/?type=${f.key}#collection`}
              scroll={false}
              aria-current={active === f.key ? "page" : undefined}
              className={styles.tab}
            >
              {f.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
