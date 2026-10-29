"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { KeyboardIcon, MicIcon, SpeakerIcon, StopIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { Eyebrow } from "@/components/ui/Text";
import { api, transcribe, type ShapeResult } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import styles from "../Create.module.css";

type Phase = "idle" | "recording" | "transcribing" | "review" | "shaping" | "question";

/**
 * Say it out loud: record → transcribe → review ("YOU SAID") → Done → shape the prompt.
 * If the shaper asks a clarifying question, it is spoken aloud and answered by voice or text.
 */
export function Speak() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [typing, setTyping] = useState(false);
  const [transcript, setTranscript] = useState(draft.transcript ?? "");
  const [answers, setAnswers] = useState<string[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false); // recording an answer (vs. the idea)
  const [error, setError] = useState<string | null>(null);

  async function handleAudio(blob: Blob | null, forAnswer: boolean) {
    if (!blob) { setPhase(forAnswer ? "question" : "idle"); return; }
    setPhase("transcribing");
    try {
      const text = await transcribe(blob);
      if (forAnswer) { await shape(transcript, [...answers, text]); return; }
      setTranscript(text);
      setPhase("review");
    } catch {
      setError(m.create.errorGeneric);
      setPhase(forAnswer ? "question" : "idle");
    }
  }

  const recorder = useRecorder({ onAutoStop: (b) => void handleAudio(b, answering) });

  async function startRecording(forAnswer: boolean) {
    setError(null);
    setAnswering(forAnswer);
    const ok = await recorder.start();
    if (ok) setPhase("recording");
    else setTyping(true);
  }
  async function stopRecording() {
    const blob = await recorder.stop();
    await handleAudio(blob, answering);
  }

  async function shape(text: string, nextAnswers: string[]) {
    if (!draft.product || !text.trim()) return;
    setError(null);
    setPhase("shaping");
    try {
      const res = await api<ShapeResult>("prompts/shape", { json: { transcript: text, answers: nextAnswers, product: draft.product } });
      setAnswers(nextAnswers);
      if (res.clarifying_question) {
        setQuestion(res.clarifying_question);
        setPhase("question");
        speak(res.clarifying_question);
        return;
      }
      update({ transcript: text, answers: nextAnswers, shaped: res, variants: undefined, artworkId: undefined });
      speak(res.spoken_confirmation);
      router.push("/create/drawing");
    } catch {
      setError(m.create.errorGeneric);
      setPhase(question ? "question" : "review");
    }
  }

  if (ready && !draft.product) return <MissingState />;
  const micProblem = recorder.status === "denied" ? m.create.speak.micDenied : recorder.status === "unsupported" ? m.create.speak.micUnsupported : null;
  const busy = phase === "transcribing" || phase === "shaping";

  // ---- clarifying question
  if (phase === "question" || (phase === "recording" && answering) || (busy && question)) {
    return (
      <CreateScreen back="/create/method" step={3} title={m.create.speak.questionTitle} mascot="listening">
        <Card pad="l">
          <p className={styles.saidText} aria-live="polite">{question}</p>
        </Card>
        <Button variant="secondary" arrow={false} icon={<SpeakerIcon />} onClick={() => question && speak(question)}>{m.create.speak.hearAgain}</Button>
        {busy ? <Loading label={phase === "transcribing" ? m.create.speak.transcribing : m.create.speak.shaping} /> : null}
        {!busy && phase === "recording" ? <ListeningCard seconds={recorder.seconds} onStop={stopRecording} /> : null}
        {!busy && phase === "question" ? (
          typing || micProblem ? (
            <AnswerForm onSubmit={(a) => shape(transcript, [...answers, a])} onSpeak={micProblem ? undefined : () => { setTyping(false); void startRecording(true); }} />
          ) : (
            <div className={styles.recordWrap}>
              <button type="button" className={styles.record} onClick={() => startRecording(true)} aria-label={m.create.speak.answerSpeak}><MicIcon /></button>
              <span aria-hidden="true">{m.create.speak.answerSpeak}</span>
              <Button variant="ghost" arrow={false} icon={<KeyboardIcon />} onClick={() => setTyping(true)}>{m.create.typeInstead}</Button>
            </div>
          )
        ) : null}
        {micProblem ? <Status>{micProblem}</Status> : null}
        {error ? <Status tone="error">{error}</Status> : null}
      </CreateScreen>
    );
  }

  // ---- idea
  const footer = phase === "review" ? (
    <>
      <Button block onClick={() => shape(transcript, [])} disabled={busy}>{m.create.speak.done}</Button>
      <Button block variant="secondary" arrow={false} icon={<MicIcon />} onClick={() => { setTranscript(""); setPhase("idle"); setTyping(false); }}>{m.create.speak.redo}</Button>
    </>
  ) : null;

  return (
    <CreateScreen back="/create/method" step={3} title={m.create.speak.title} lead={phase === "idle" ? m.create.speak.hint : undefined} mascot="listening" footer={footer}>
      {phase === "recording" ? <ListeningCard seconds={recorder.seconds} onStop={stopRecording} /> : null}
      {busy ? <Loading label={phase === "transcribing" ? m.create.speak.transcribing : m.create.speak.shaping} /> : null}
      {phase === "review" ? (
        <Card pad="l" className={styles.said}>
          <Eyebrow>{m.create.speak.youSaid}</Eyebrow>
          <Field multiline rows={3} label={m.create.speak.textLabel} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        </Card>
      ) : null}
      {phase === "idle" ? (
        typing || micProblem ? (
          <form className={styles.said} onSubmit={(e) => { e.preventDefault(); if (transcript.trim()) setPhase("review"); }}>
            <Field multiline rows={4} label={m.create.speak.textLabel} placeholder={m.create.speak.textPlaceholder} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
            <Button type="submit" block disabled={!transcript.trim()}>{m.common.next}</Button>
            {!micProblem ? <Button variant="ghost" arrow={false} icon={<MicIcon />} onClick={() => setTyping(false)}>{m.create.speakInstead}</Button> : null}
          </form>
        ) : (
          <div className={styles.recordWrap}>
            <button type="button" className={styles.record} onClick={() => startRecording(false)} aria-label={m.create.speak.start}><MicIcon /></button>
            <span aria-hidden="true">{m.create.speak.start}</span>
            <Button variant="ghost" arrow={false} icon={<KeyboardIcon />} onClick={() => setTyping(true)}>{m.create.typeInstead}</Button>
          </div>
        )
      ) : null}
      {micProblem ? <Status>{micProblem}</Status> : null}
      {error ? <Status tone="error">{error}</Status> : null}
    </CreateScreen>
  );
}

function ListeningCard({ seconds, onStop }: { seconds: number; onStop: () => void }) {
  return (
    <Card pad="l" tone="lime" className={styles.listen}>
      <p className={styles.listenEyebrow} role="status"><span className={styles.pulse} aria-hidden="true" /><Eyebrow as="span">{m.create.speak.listening}</Eyebrow></p>
      <span className={styles.bars} aria-hidden="true"><span /><span /><span /><span /><span /></span>
      <p aria-hidden="true">{fmt(m.create.speak.seconds, { s: seconds })}</p>
      <p>{m.create.speak.listeningHint}</p>
      <button type="button" className={styles.record} data-recording="true" onClick={onStop} aria-label={m.create.speak.stop}><StopIcon /></button>
    </Card>
  );
}

function AnswerForm({ onSubmit, onSpeak }: { onSubmit: (answer: string) => void; onSpeak?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form className={styles.said} onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}>
      <Field label={m.create.speak.answerLabel} value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" block disabled={!value.trim()}>{m.create.speak.answerSubmit}</Button>
      {onSpeak ? <Button variant="ghost" arrow={false} icon={<MicIcon />} onClick={onSpeak}>{m.create.speakInstead}</Button> : null}
    </form>
  );
}
