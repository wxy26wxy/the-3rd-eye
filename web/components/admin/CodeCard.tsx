"use client";
import type { IssuedView } from "@/app/admin/actions";
import { fmt, m } from "@/components/messages";
import { QrCode } from "@/components/qr/QrCode";
import { CopyButton } from "@/components/site/CopyButton";
import { Button } from "@/components/ui/Button";
import styles from "./Admin.module.css";

const c = m.admin.creators;

/**
 * The one-time code card (board 2031:3895, fixed r4): green card above the Creators table. The live
 * region is always mounted so it announces, and holds only the message and the code. Then Copy code
 * and the QR, the sign-in link and the iPhone app link (each with Copy), the notes, and the primary
 * "Done, hide the code".
 */
export function CodeCard({ issued, onDone }: { issued: IssuedView | null; onDone: () => void }) {
  return (
    <div className={issued ? styles.codeCard : undefined} role={issued ? "group" : undefined} aria-labelledby={issued ? "code-card-title" : undefined}>
      <div aria-live="polite" aria-atomic="true" className={styles.codeLive}>
        {issued ? (
          <>
            <p id="code-card-title" className={styles.codeMessage}>{issued.message}</p>
            <p className={styles.codeLine}><span className={styles.boxLabel}>{c.codeLabel}<span className="visually-hidden">: </span></span><span className={styles.code}>{issued.code}</span></p>
          </>
        ) : null}
      </div>
      {issued ? (
        <>
          <QrCode value={issued.qrUrl} label={fmt(c.qrLabel, { name: issued.displayName })} className={styles.codeQr} />
          <div className={styles.codeCopy}><CopyButton value={issued.code} label={c.copyCode} copiedLabel={m.common.copied} className={styles.copyBlock} /></div>
          <div className={styles.box}>
            <p className={styles.boxLabel}>{c.linkLabel}</p>
            <p className={styles.url}>{issued.signInUrl}</p>
            <CopyButton value={issued.signInUrl} label={c.copyLink} copiedLabel={m.common.copied} className={styles.copyBlock} />
          </div>
          <div className={styles.box}>
            <p className={styles.boxLabel}>{c.appLink}</p>
            <p className={styles.url}>{issued.appUrl}</p>
            <CopyButton value={issued.appUrl} label={c.copyLink} copiedLabel={m.common.copied} className={styles.copyBlock} />
          </div>
          <p className={styles.codeNote}>{c.onceNote}</p>
          <p className={styles.codeNote}>{c.sensitive}</p>
          <p className={styles.codeNote}>{c.linkNote}</p>
          <Button block onClick={onDone}>{c.dismiss}</Button>
        </>
      ) : null}
    </div>
  );
}
