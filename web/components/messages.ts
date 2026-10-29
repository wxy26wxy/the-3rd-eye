/** User-facing copy. All strings live in messages/en.json, keyed by screen. */
import en from "@/messages/en.json";

export const m = en;
export type Messages = typeof en;

/** Replace {name} placeholders. Unknown keys are left as-is so missing data is visible. */
export function fmt(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function money(cents: number): string {
  return usd.format(cents / 100);
}

/** Creator share of a price in whole percent, from basis points. */
export function sharePercent(bps: number | undefined): number {
  return Math.round((bps ?? 5000) / 100);
}
