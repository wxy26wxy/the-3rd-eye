import styles from "./Avatar.module.css";

/** Round avatar; falls back to the first letter on lime. Decorative next to the name. */
export function Avatar({ name, src, size = "m" }: { name: string; src: string | null | undefined; size?: "m" | "l" }) {
  const cls = [styles.avatar, styles[size]].join(" ");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cls} />;
  }
  return <span className={cls} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}
