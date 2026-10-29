"use client";
import { useActionState, useState } from "react";
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

  return (
    <section aria-labelledby="creators-title" className={styles.section}>
      <h2 id="creators-title" className={styles.h2}>{c.title}</h2>
      <p className={styles.sub}>{c.lead}</p>

      <div aria-live="polite">
        {issued ? <CodeCard issued={issued} onDone={() => setDismissedAt(issued.at)} /> : null}
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
                    <form action={rotateAction}>
                      <input type="hidden" name="creatorId" value={row.id} />
                      <button type="submit" className={styles.statusBtn} disabled={rotating} aria-label={fmt(c.newCodeLabel, { name: row.displayName })}>
                        {c.newCode}
                      </button>
                    </form>
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

function CodeCard({ issued, onDone }: { issued: IssuedView; onDone: () => void }) {
  return (
    <div className={styles.codeCard} role="group" aria-labelledby="code-card-title">
      <p id="code-card-title" className={styles.strong}>{issued.message}</p>
      <div className={styles.codeBody}>
        <QrCode value={issued.signInUrl} label={fmt(c.qrLabel, { name: issued.displayName })} className={styles.codeQr} />
        <dl className={styles.dl}>
          <dt>{c.codeLabel}</dt>
          <dd><span className={styles.code}>{issued.code}</span></dd>
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
      <Button variant="secondary" arrow={false} onClick={onDone}>{c.dismiss}</Button>
    </div>
  );
}
