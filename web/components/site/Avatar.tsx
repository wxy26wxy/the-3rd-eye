import styles from "./Avatar.module.css";

/** Up to two initials ("Rosa M." → "RM"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/**
 * Round avatar (Sky): the photo, or initials in deep green on the accent. Decorative next to the
 * visible name. `m` 40 px, `l` 56 px (story / product creator row), `xl` 80 px (artist cards), `xxl` 120 px from 64rem (profile header).
 */
export function Avatar({ name, src, size = "m" }: { name: string; src: string | null | undefined; size?: "m" | "l" | "xl" | "xxl" }) {
  const cls = [styles.avatar, styles[size]].join(" ");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cls} />;
  }
  return <span className={cls} aria-hidden="true">{initials(name)}</span>;
}
