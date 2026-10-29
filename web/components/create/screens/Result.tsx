"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { KeyboardIcon, MicIcon, StopIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { Eyebrow } from "@/components/ui/Text";
import { api, transcribe, type ArtworkVariant } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { makeProduct, useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import { VariantPicker } from "./VariantPicker";
import styles from "../Create.module.css";

type Phase = "pick" | "change" | "recording" | "changing" | "making";

export function Result() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const [phase, setPhase] = useState<Phase>("pick");
  const [typing, setTyping] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRecorder({ onAutoStop: (b) => void afterRecording(b) });

  const variants = draft.variants ?? [];
  const selected = draft.artworkId ?? variants[0]?.id;
  if (ready && (!variants.length || !draft.product)) return <MissingState />;
  const productLabel = draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase();

  async function refine(text: string) {
    if (!selected || !text.trim()) return;
    setPhase("changing");
    setError(null);
    try {
      const { artwork } = await api<{ artwork: ArtworkVariant }>(`artworks/${selected}/refine`, { json: { instruction: text.trim() } });
      update({ variants: [artwork, ...variants], artworkId: artwork.id });
      setInstruction("");
      setPhase("pick");
      if (artwork.spokenDescription) speak(artwork.spokenDescription);
    } catch {
      setError(m.create.errorGeneric);
      setPhase("change");
    }
  }
  async function afterRecording(blob: Blob | null) {
    if (!blob) { setPhase("change"); return; }
    setPhase("changing");
    try { await refine(await transcribe(blob)); } catch { setError(m.create.errorGeneric); setPhase("change"); }
  }
  async function useThis() {
    if (!selected || !draft.product) return;
    setPhase("making");
    setError(null);
    try {
      await makeProduct(selected, draft.product);
      router.push("/create/ready");
    } catch {
      setError(m.create.errorGeneric);
      setPhase("pick");
    }
  }

  const footer = phase === "pick" ? (
    <>
      <Button block onClick={useThis} disabled={!selected}>{m.create.result.use}</Button>
      <Button block variant="secondary" arrow={false} icon={<MicIcon />} onClick={() => setPhase("change")}>{m.create.result.change}</Button>
    </>
  ) : null;

  return (
    <CreateScreen back="/create/speak" step={3} title={m.create.result.title} footer={footer}>
      {draft.transcript ? (
        <Card pad="m" className={styles.said}>
          <Eyebrow>{m.create.result.youSaid}</Eyebrow>
          <p className={styles.saidText}>“{draft.transcript}”</p>
        </Card>
      ) : null}
      {phase === "making" ? <Loading label={fmt(m.create.result.making, { product: productLabel })} /> : null}
      {phase === "changing" ? <Loading label={m.create.result.changing} /> : null}
      {phase === "change" || phase === "recording" ? (
        <Card pad="l" className={styles.said}>
          {phase === "recording" ? (
            <div className={styles.recordWrap}>
              <p role="status">{m.create.speak.listening}</p>
              <button type="button" className={styles.record} data-recording="true" aria-label={m.create.speak.stop} onClick={async () => afterRecording(await recorder.stop())}><StopIcon /></button>
            </div>
          ) : typing || recorder.status === "denied" || recorder.status === "unsupported" ? (
            <form className={styles.said} onSubmit={(e) => { e.preventDefault(); void refine(instruction); }}>
              <Field label={m.create.result.changeLabel} placeholder={m.create.result.changePlaceholder} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              <Button type="submit" block disabled={!instruction.trim()}>{m.create.result.changeSubmit}</Button>
            </form>
          ) : (
            <div className={styles.recordWrap}>
              <p>{m.create.result.changeLabel}</p>
              <button type="button" className={styles.record} aria-label={m.create.speak.start} onClick={async () => { if (await recorder.start()) setPhase("recording"); else setTyping(true); }}><MicIcon /></button>
              <Button variant="ghost" arrow={false} icon={<KeyboardIcon />} onClick={() => setTyping(true)}>{m.create.typeInstead}</Button>
            </div>
          )}
          <Button variant="ghost" arrow={false} onClick={() => { setPhase("pick"); setTyping(false); }}>{m.common.back}</Button>
        </Card>
      ) : null}
      {error ? <Status tone="error">{error}</Status> : null}
      <VariantPicker
        name="variant"
        legend={m.create.result.groupLabel}
        items={variants.map((v) => ({ id: v.id, src: v.previewUrl ?? v.cleanedUrl, alt: v.altText ?? "", spoken: v.spokenDescription ?? v.altText }))}
        selected={selected}
        onSelect={(id) => update({ artworkId: id })}
        itemLabel={m.create.result.variant}
        hearLabel={m.create.result.hear}
        stopLabel={m.create.result.stop}
        placeholder={m.common.imageMissing}
      />
    </CreateScreen>
  );
}
