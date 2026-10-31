import type { ReactNode } from "react";

/**
 * Deprecated (Sky, T102): the boards have no starburst badge. Renders nothing; the export stays
 * so older call sites compile. Short labels like "No pen needed!" become an `Eyebrow`.
 */
export function Starburst(props: { children: ReactNode; size?: "s" | "m"; className?: string }) {
  void props;
  return null;
}
