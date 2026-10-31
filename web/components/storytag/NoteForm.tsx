"use client";
import { useActionState } from "react";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Loading";
import type { NoteState } from "@/app/t/[token]/actions";
import styles from "./StoryTag.module.css";

/** Note form (component 2010:571): label, field, hint, errors under the field (announced), Send note; success replaces the form. */
export function NoteForm({ action, name }: { action: (prev: NoteState, fd: FormData) => Promise<NoteState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) return <Status tone="success">{fmt(m.tag.noteSent, { name })}</Status>;
  return (
    <form action={formAction} className={styles.form} noValidate>
      <Field multiline name="body" rows={3} maxLength={1000} label={fmt(m.tag.noteLabel, { name })} hint={m.tag.noteHint} hintPosition="below" defaultValue={state.value} error={state.error} />
      <Button type="submit" block disabled={pending}>{pending ? m.tag.noteSending : m.tag.noteSubmit}</Button>
    </form>
  );
}
