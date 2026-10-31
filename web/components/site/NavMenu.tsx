"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { m } from "@/components/messages";
import { ChevronRightIcon, CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { NAV_LINKS } from "./navLinks";
import { Wordmark } from "./Wordmark";
import styles from "./Site.module.css";

/**
 * Phone nav (ruling 3, boards 2033:3991 / 2032:4004). "Menu" (aria-expanded, aria-controls) opens a modal
 * <dialog>: the browser makes the page behind inert and keeps Tab inside it, Esc closes it, and the
 * ::backdrop is the scrim. The drawer repeats the header so "Close" sits where "Menu" was. Focus goes to
 * the first link on open and back to Menu on close.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const show = () => {
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    setOpen(true);
    firstLinkRef.current?.focus();
  };
  const hide = () => {
    const d = dialogRef.current;
    if (d?.open) d.close();
  };

  return (
    <>
      <button ref={buttonRef} type="button" className={styles.menuButton} aria-expanded={open} aria-controls="nav-drawer" onClick={show}>
        <MenuIcon size="1.25rem" />
        {m.nav.menu}
      </button>
      <dialog
        ref={dialogRef}
        id="nav-drawer"
        className={styles.drawer}
        aria-label={m.nav.label}
        onClose={() => { setOpen(false); buttonRef.current?.focus(); }}
        onClick={(e) => { if (e.target === e.currentTarget) hide(); }}
      >
        <div className={styles.drawerHead}>
          <Wordmark />
          <button type="button" className={styles.menuButton} onClick={hide}>
            <CloseIcon size="1.25rem" />
            {m.common.close}
          </button>
        </div>
        <nav aria-label={m.nav.label}>
          <ul role="list" className={styles.drawerList}>
            {NAV_LINKS.map((l, i) => (
              <li key={l.href}>
                <Link href={l.href} ref={i === 0 ? firstLinkRef : undefined} className={styles.drawerLink} onClick={hide}>
                  {l.label}
                  <ChevronRightIcon size="1.25rem" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
