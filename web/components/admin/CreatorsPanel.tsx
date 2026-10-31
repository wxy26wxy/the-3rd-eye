"use client";
import { useActionState, useRef, useState, type RefObject } from "react";
import { addCreator, rotateCreatorCode, setCreatorHidden, type CreatorState, type IssuedView } from "@/app/admin/actions";
import type { AdminCreator } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field, Switch } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Text";
import { ErrorCard } from "@/components/create/cards";
import { CodeCard } from "./CodeCard";
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
      <p className={styles.lead}>{c.lead}</p>

      <CodeCard issued={issued} onDone={() => issued && done(issued.at)} />

      {creators.length === 0 ? <p className={styles.empty}>{c.empty}</p> : (
        <div className={styles.scroll} role="region" aria-labelledby="creators-title" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{c.colName}</th>
                <th scope="col">{c.colStudio}</th>
                <th scope="col">{c.colShop}</th>
                <th scope="col">{c.colProducts}</th>
                <th scope="col">{c.colCode}</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <span className={styles.nameLine}><span className={styles.strong}>{row.displayName}</span>{row.isExample ? <Chip tone="cream">{c.example}</Chip> : null}</span>
                    <span className={styles.sub}>{row.slug}</span>
                  </th>
                  <td>{row.studioName ?? ""}</td>
                  <td>
                    <div className={styles.shopCell}>
                      <Chip tone={row.hidden ? "cream" : "lime"}>{row.hidden ? c.hiddenChip : c.visibleChip}</Chip>
                      <HiddenToggle id={row.id} hidden={row.hidden} name={row.displayName} />
                    </div>
                  </td>
                  <td>{row.publishedProducts}</td>
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
        <h3 id="add-creator-title" className={styles.formTitle}>{c.addTitle}</h3>
        <Field label={c.displayName} name="displayName" required maxLength={80} autoComplete="off" />
        <Field label={c.studioName} name="studioName" maxLength={120} autoComplete="off" />
        <Switch label={c.mentionDisability} hint={c.mentionDisabilityHint} name="mentionDisability" className={styles.toggleRow} />
        <Switch label={c.hiddenField} hint={c.hiddenFieldHint} name="hidden" className={styles.toggleRow} />
        {added.error ? <ErrorCard>{added.error}</ErrorCard> : null}
        <Button type="submit" disabled={adding}>{c.add}</Button>
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
      <button type="submit" className={styles.pill} disabled={pending} aria-label={`${hidden ? c.show : c.hide}: ${name}`}>
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
      <button ref={triggerRef} type="button" className={styles.pill} disabled={pending} aria-label={fmt(c.newCodeLabel, { name })}
        onClick={() => { setConfirming(true); setTimeout(() => yesRef.current?.focus(), 0); }}>
        {c.newCode}
      </button>
    );
  }
  const back = () => { setConfirming(false); setTimeout(() => triggerRef.current?.focus(), 0); };
  return <RotateConfirm id={id} name={name} isExample={isExample} action={action} pending={pending} yesRef={yesRef} onSubmit={() => setTimeout(back, 0)} onCancel={back} />;
}

/** The confirm step of New code (Confirmation dialog pattern): the warning, the example note, Yes / Cancel. */
export function RotateConfirm({ id, name, isExample, action, pending, yesRef, onSubmit, onCancel }: {
  id: string; name: string; isExample: boolean; action: (fd: FormData) => void; pending: boolean;
  yesRef?: RefObject<HTMLButtonElement | null>; onSubmit?: () => void; onCancel: () => void;
}) {
  return (
    <form action={action} onSubmit={onSubmit} className={styles.confirm} role="group" aria-label={fmt(c.newCodeLabel, { name })}>
      <input type="hidden" name="creatorId" value={id} />
      <p className={styles.sub}>{fmt(c.rotateConfirm, { name })}</p>
      {isExample ? <p className={styles.sub}>{c.exampleNote}</p> : null}
      <div className={styles.statusForm}>
        <button ref={yesRef} type="submit" className={styles.pill} disabled={pending}>{c.rotateYes}</button>
        <button type="button" className={styles.pill} onClick={onCancel}>{c.rotateCancel}</button>
      </div>
    </form>
  );
}
