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
 * <dialog>: the browser makes the page behind inert, Tab wraps inside it, Esc closes it, and the
 * ::backdrop is the scrim. The drawer repeats the header so "Close" sits where "Menu" was. Focus goes to
 * the first link on open and back to Menu on Close / Esc; a chosen link skips that return, and a
 * link to a section of the current page focuses the section.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const viaLink = useRef(false);

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

  /** Close for a chosen link; a link to a section of this page focuses that section (it has tabIndex -1). */
  const chooseLink = (href: string) => {
    viaLink.current = true;
    hide();
    const [path, hash] = href.split("#");
    if (hash && (path || "/") === window.location.pathname) {
      setTimeout(() => document.getElementById(hash)?.focus(), 0);
    }
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
        onClose={() => {
          setOpen(false);
          // A chosen link moves the reader on: no focus return to Menu (it may now be off-screen).
          if (viaLink.current) { viaLink.current = false; return; }
          buttonRef.current?.focus();
        }}
        onClick={(e) => { if (e.target === e.currentTarget) hide(); }}
        onKeyDown={(e) => {
          // Keep Tab inside the drawer (the native modal would let it reach the browser UI between cycles).
          if (e.key !== "Tab") return;
          const items = [...e.currentTarget.querySelectorAll<HTMLElement>("a[href], button")];
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }}
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
                <Link href={l.href} ref={i === 0 ? firstLinkRef : undefined} className={styles.drawerLink} onClick={() => chooseLink(l.href)}>
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
