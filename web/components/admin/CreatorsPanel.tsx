"use client";
import { useActionState, useRef, useState } from "react";
import { addCreator, rotateCreatorCode, setCreatorHidden, type CreatorState, type IssuedView } from "@/app/admin/actions";
import type { AdminCreator } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { QrCode } from "@/components/qr/QrCode";
import { CopyButton } from "@/components/site/CopyButton";
import { Button } from "@/components/ui/Button";
import { Field, Switch } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Text";
import styles from "./Admin.module.css";

const c = m.admin.creators;

/**
 * Creators table, Add creator form and the one-time code card. The code only ever lives in
 * the action's response and this component's state: a reload or "Done" and it is gone.
 */
export function CreatorsPanel({ creators }: { creators: AdminCreator[] }) {
  const [added, addAction, adding] = useActionState<CreatorState, FormData>(addCreator, {});
  const [rotated, rotateAction, rotating] = useActionState<CreatorState, FormData>(rotateCreatorCode, {});
  const [dismissedAt, setDismissedAt] = useState(0);
  const latest = [added.issued, rotated.issued].filter((x): x is IssuedView => Boolean(x)).sort((a, b) => b.at - a.at)[0];
  const issued = latest && latest.at > dismissedAt ? latest : null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = (at: number) => { setDismissedAt(at); headingRef.current?.focus(); };

  return (
    <section aria-labelledby="creators-title" className={styles.section}>
      <h2 id="creators-title" className={styles.h2} ref={headingRef} tabIndex={-1}>{c.title}</h2>
      <p className={styles.sub}>{c.lead}</p>

      {/* Always mounted so the live region announces; it holds only the message and the code. */}
      <div className={issued ? styles.codeCard : undefined} role={issued ? "group" : undefined} aria-labelledby={issued ? "code-card-title" : undefined}>
        <div aria-live="polite" aria-atomic="true" className={styles.codeLive}>
          {issued ? (
            <>
              <p id="code-card-title" className={styles.strong}>{issued.message}</p>
              <p><span className="visually-hidden">{c.codeLabel}: </span><span className={styles.code}>{issued.code}</span></p>
            </>
          ) : null}
        </div>
        {issued ? <CodeDetails issued={issued} onDone={() => done(issued.at)} /> : null}
      </div>

      {creators.length === 0 ? <p className={styles.empty}>{c.empty}</p> : (
        <div className={styles.scroll} role="region" aria-labelledby="creators-title" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{c.colName}</th>
                <th scope="col">{c.colStudio}</th>
                <th scope="col">{c.colProducts}</th>
                <th scope="col">{c.colShop}</th>
                <th scope="col">{c.colCode}</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <span className={styles.strong}>{row.displayName}</span>
                    <span className={styles.sub}>{row.slug}</span>
                    {row.isExample ? <Chip tone="cream">{c.example}</Chip> : null}
                  </th>
                  <td>{row.studioName ?? ""}</td>
                  <td>{row.publishedProducts}</td>
                  <td>
                    <Chip tone={row.hidden ? "cream" : "lime"}>{row.hidden ? c.hiddenChip : c.visibleChip}</Chip>
                    <HiddenToggle id={row.id} hidden={row.hidden} name={row.displayName} />
                  </td>
                  <td>
                    <RotateCode id={row.id} name={row.displayName} isExample={row.isExample} action={rotateAction} pending={rotating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.sub}>{c.newCodeHint}</p>
      {rotated.error ? <p role="alert" className={styles.error}>{rotated.error}</p> : null}

      <form action={addAction} className={styles.addForm} aria-labelledby="add-creator-title">
        <h3 id="add-creator-title" className={styles.strong}>{c.addTitle}</h3>
        <Field label={c.displayName} name="displayName" required maxLength={80} autoComplete="off" />
        <Field label={c.studioName} name="studioName" maxLength={120} autoComplete="off" />
        <Switch label={c.mentionDisability} hint={c.mentionDisabilityHint} name="mentionDisability" />
        <Switch label={c.hiddenField} hint={c.hiddenFieldHint} name="hidden" />
        <Button type="submit" disabled={adding}>{c.add}</Button>
        {added.error ? <p role="alert" className={styles.error}>{added.error}</p> : null}
      </form>
    </section>
  );
}

function HiddenToggle({ id, hidden, name }: { id: string; hidden: boolean; name: string }) {
  const [state, action, pending] = useActionState(setCreatorHidden, {});
  return (
    <form action={action} className={styles.statusForm}>
      <input type="hidden" name="creatorId" value={id} />
      <input type="hidden" name="hidden" value={hidden ? "false" : "true"} />
      <button type="submit" className={styles.statusBtn} disabled={pending} aria-label={`${hidden ? c.show : c.hide}: ${name}`}>
        {hidden ? c.show : c.hide}
      </button>
      {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
    </form>
  );
}

/** Two steps: "New code", then "Yes, make a new code" (the old code stops working at once). */
function RotateCode({ id, name, isExample, action, pending }: {
  id: string; name: string; isExample: boolean; action: (fd: FormData) => void; pending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!confirming) {
    return (
      <button ref={triggerRef} type="button" className={styles.statusBtn} disabled={pending} aria-label={fmt(c.newCodeLabel, { name })}
        onClick={() => { setConfirming(true); setTimeout(() => yesRef.current?.focus(), 0); }}>
        {c.newCode}
      </button>
    );
  }
  return (
    <form action={action} onSubmit={() => setTimeout(() => { setConfirming(false); setTimeout(() => triggerRef.current?.focus(), 0); }, 0)} className={styles.confirm} role="group" aria-label={fmt(c.newCodeLabel, { name })}>
      <input type="hidden" name="creatorId" value={id} />
      <p className={styles.sub}>{fmt(c.rotateConfirm, { name })}</p>
      {isExample ? <p className={styles.sub}>{c.exampleNote}</p> : null}
      <div className={styles.statusForm}>
        <button ref={yesRef} type="submit" className={styles.statusBtn} disabled={pending}>{c.rotateYes}</button>
        <button type="button" className={styles.statusBtn} onClick={() => { setConfirming(false); setTimeout(() => triggerRef.current?.focus(), 0); }}>{c.rotateCancel}</button>
      </div>
    </form>
  );
}

function CodeDetails({ issued, onDone }: { issued: IssuedView; onDone: () => void }) {
  return (
    <>
      <div className={styles.codeBody}>
        <QrCode value={issued.qrUrl} label={fmt(c.qrLabel, { name: issued.displayName })} className={styles.codeQr} />
        <dl className={styles.dl}>
          <dt>{c.codeLabel}</dt>
          <dd><CopyButton value={issued.code} label={c.copyCode} copiedLabel={m.common.copied} /></dd>
          <dt>{c.linkLabel}</dt>
          <dd className={styles.url}>{issued.signInUrl}</dd>
          <dd><CopyButton value={issued.signInUrl} label={c.copyLink} copiedLabel={m.common.copied} /></dd>
          <dt>{c.appLink}</dt>
          <dd className={styles.url}>{issued.appUrl}</dd>
        </dl>
      </div>
      <p className={styles.sub}>{c.onceNote}</p>
      <p className={styles.sub}>{c.sensitive}</p>
      <p className={styles.sub}>{c.linkNote}</p>
      <Button variant="secondary" arrow={false} onClick={onDone}>{c.dismiss}</Button>
    </>
  );
}
