"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak, stopSpeaking } from "@/components/speech";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MicIcon, StopIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { api, transcribe, type ArtworkVariant } from "../api";
import { InfoCard } from "../cards";
import { CreateScreen, MissingState } from "../CreateScreen";
import { makeProduct, useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import { VariantPicker } from "./VariantPicker";
import { describeError, ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

type Phase = "pick" | "change" | "recording" | "changing" | "making";

/**
 * Here's what I made (boards `2027:3091` pick, `2027:3138` change it, `2038:4035` changing / making,
 * `2038:4060` error): YOU SAID, the picture row, the chosen picture large, its description as visible
 * text ("WHAT THE IMAGE SHOWS") with "Hear what the image shows", and Use this / Change it in the bar.
 */
export function Result() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const [phase, setPhase] = useState<Phase>("pick");
  const [typing, setTyping] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<ScreenError | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const recorder = useRecorder({ onAutoStop: (b) => void afterRecording(b) });
  useEffect(() => () => stopSpeaking(), []);

  const variants = draft.variants ?? [];
  const selected = draft.artworkId ?? variants[0]?.id;
  if (ready && (!variants.length || !draft.product)) return <MissingState />;
  const productLabel = draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase();
  const current = variants.find((v) => v.id === selected);
  const description = current?.spokenDescription ?? current?.altText ?? null;

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
    } catch (err) {
      setError(describeError(err));
      setRetry(() => () => void refine(text));
      setPhase("pick");
    }
  }
  async function afterRecording(blob: Blob | null) {
    if (!blob) { setError(describeError(null)); setRetry(null); setPhase("change"); return; }
    setPhase("changing");
    try { await refine(await transcribe(blob)); } catch (err) { setError(describeError(err)); setRetry(null); setPhase("change"); }
  }
  async function chooseThis() {
    if (!selected || !draft.product) return;
    setPhase("making");
    setError(null);
    try {
      await makeProduct(selected, draft.product);
      router.push("/create/ready");
    } catch (err) {
      setError(describeError(err));
      setRetry(() => () => void chooseThis());
      setPhase("pick");
    }
  }
  function hear() {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    if (!description) return;
    setPlaying(true);
    speak(description, { onEnd: () => setPlaying(false) });
  }

  const busy = phase === "changing" || phase === "making";
  const changing = phase === "change" || phase === "recording";
  const footer = phase === "pick" ? (
    <>
      <Button block onClick={chooseThis} disabled={!selected}>{m.create.result.use}</Button>
      <Button block variant="secondary" arrow={false} onClick={() => { setError(null); setPhase("change"); }}>{m.create.result.change}</Button>
    </>
  ) : null;
  const preview = (
    <div className={styles.previewCard}>
      <ArtImage src={current?.previewUrl ?? current?.cleanedUrl ?? null} alt={current?.altText ?? ""} placeholder={m.common.imageMissing} ratio="auto" eager className={styles.previewArt} />
    </div>
  );

  return (
    <CreateScreen back="/create/speak" step={3} title={m.create.result.title} footer={footer}>
      {draft.transcript && !busy && !error ? <InfoCard eyebrow={m.create.result.youSaid}><p>{draft.transcript}</p></InfoCard> : null}
      {!busy && !error ? (
        <VariantPicker
          name="variant"
          legend={m.create.result.groupLabel}
          items={variants.map((v) => ({ id: v.id, src: v.previewUrl ?? v.cleanedUrl, alt: v.altText ?? "" }))}
          selected={selected}
          onSelect={(id) => { stopSpeaking(); setPlaying(false); update({ artworkId: id }); }}
          itemLabel={m.create.result.variant}
          placeholder={m.common.imageMissing}
          disabled={phase === "recording"}
        />
      ) : null}
      {busy ? (
        <>
          {preview}
          <Loading inline label={phase === "making" ? fmt(m.create.result.making, { product: productLabel }) : m.create.result.changing} />
        </>
      ) : changing ? (
        <div className={styles.changeCard}>
          {phase === "recording" ? (
            <div className={styles.recordWrap}>
              <p role="status" className={styles.seconds}>{fmt(m.create.speak.seconds, { s: recorder.seconds })}</p>
              <button type="button" className={styles.record} data-recording="true" aria-label={m.create.speak.stop} onClick={async () => afterRecording(await recorder.stop())}><StopIcon /></button>
              <span aria-hidden="true">{m.create.speak.stop}</span>
            </div>
          ) : (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void refine(instruction); }}>
              <Field multiline rows={3} label={m.create.result.changeLabel} placeholder={m.create.result.changePlaceholder} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              {!typing && recorder.status !== "denied" && recorder.status !== "unsupported" ? (
                <div className={styles.recordWrap}>
                  <button type="button" className={styles.record} aria-label={m.create.speak.start} onClick={async () => { if (await recorder.start()) setPhase("recording"); else setTyping(true); }}><MicIcon /></button>
                  <span aria-hidden="true">{m.create.speak.start}</span>
                </div>
              ) : null}
              <Button type="submit" block disabled={!instruction.trim()}>{m.create.result.changeSubmit}</Button>
            </form>
          )}
          <Button variant="ghost" arrow={false} className={styles.textAction} onClick={() => { if (phase === "recording") void recorder.stop(); setPhase("pick"); setTyping(false); }}>{m.common.back}</Button>
        </div>
      ) : error ? (
        <>
          {preview}
          <ErrorNotice error={error} onRetry={retry ?? undefined} />
        </>
      ) : (
        <>
          {preview}
          {description ? <InfoCard eyebrow={m.create.result.shows}><p>{description}</p></InfoCard> : null}
          {description ? (
            <Button variant="ghost" arrow={false} className={styles.textAction} aria-pressed={playing} onClick={hear}>
              {playing ? m.create.result.stop : m.create.result.hear}
            </Button>
          ) : null}
        </>
      )}
    </CreateScreen>
  );
}
