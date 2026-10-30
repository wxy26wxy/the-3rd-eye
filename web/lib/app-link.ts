import { BRAND } from "./brand";

/** iOS sign-in link that pre-fills the code screen. The scheme comes from design/tokens.json (`brand.scheme`). */
export function appCodeLink(code: string): string {
  return `${BRAND.scheme}://code/${encodeURIComponent(code)}`;
}
