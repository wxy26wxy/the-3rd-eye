"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MicIcon, StopIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { ErrorCard, InfoCard } from "../cards";
import { api, transcribe, type ShapeResult } from "../api";
import { CreateScreen, HydratingScreen, MissingState } from "../CreateScreen";
import { useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import styles from "../Create.module.css";
import { describeError } from "../errors";

type Phase = "idle" | "recording" | "transcribing" | "review" | "shaping" | "question";

/**
 * Say it out loud (boards `2026:3067` listening, `2026:3098` question, `2026:3135` microphone off):
 * record → transcribe → review ("YOU SAID") → Done → shape the prompt. If the shaper asks a
 * clarifying question, it is spoken aloud (and again with "Hear the question again") and answered
 * by voice or text.
 */
export function Speak() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={m.create.speak.title} />;
  if (!draft.product) return <MissingState />;
  return <SpeakFlow />;
}

function SpeakFlow() {
  const router = useRouter();
  const { draft, update } = useCreate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [typing, setTyping] = useState(false);
  const [transcript, setTranscript] = useState(draft.transcript ?? "");
  const [answers, setAnswers] = useState<string[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false); // recording an answer (vs. the idea)
  const [error, setError] = useState<string | null>(null);

  async function handleAudio(blob: Blob | null, forAnswer: boolean) {
    if (!blob) { setError(m.create.errorGeneric); setPhase(forAnswer ? "question" : "idle"); return; }
    setPhase("transcribing");
    try {
      const text = await transcribe(blob);
      if (forAnswer) { await shape(transcript, [...answers, text]); return; }
      setTranscript(text);
      setPhase("review");
    } catch (err) {
      setError(describeError(err).message);
      setPhase(forAnswer ? "question" : "idle");
    }
  }

  const recorder = useRecorder({ onAutoStop: (b) => void handleAudio(b, answering) });

  // Typing chosen while the browser's mic prompt was still open: a late grant must not start recording.
  const typingRef = useRef(typing);
  useEffect(() => { typingRef.current = typing; }, [typing]);
  async function startRecording(forAnswer: boolean) {
    setError(null);
    setAnswering(forAnswer);
    typingRef.current = false;
    const ok = await recorder.start();
    if (ok && typingRef.current) { void recorder.stop(); return; }
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
        setTyping(false); // the question opens with the mic; the typed answer comes after "Type instead"
        setPhase("question");
        speak(res.clarifying_question);
        return;
      }
      update({ transcript: text, answers: nextAnswers, shaped: res, variants: undefined, artworkId: undefined });
      speak(res.spoken_confirmation);
      router.push("/create/drawing");
    } catch (err) {
      setError(describeError(err).message);
      setPhase(question ? "question" : "review");
    }
  }

  const micProblem = recorder.status === "denied" ? m.create.speak.micDenied : recorder.status === "unsupported" ? m.create.speak.micUnsupported : null;
  const busy = phase === "transcribing" || phase === "shaping";
  const busyLine = busy ? <Loading inline label={phase === "transcribing" ? m.create.speak.transcribing : m.create.speak.shaping} /> : null;
  /** "Type instead" while recording drops the recording and opens the text box. */
  async function typeInstead() {
    if (phase === "recording") { await recorder.stop(); setPhase(answering ? "question" : "idle"); }
    setTyping(true);
  }

  // ---- clarifying question (board 2026:3098)
  if (phase === "question" || (phase === "recording" && answering) || (busy && question)) {
    return (
      <CreateScreen back="/create/method" step={3} title={m.create.speak.questionTitle}>
        <InfoCard tone="green" aria-live="polite"><p>{question}</p></InfoCard>
        <TextAction onClick={() => question && speak(question)}>{m.create.speak.hearAgain}</TextAction>
        {transcript ? <InfoCard eyebrow={m.create.speak.youSaid}><p>{transcript}</p></InfoCard> : null}
        {busyLine}
        {!busy && phase === "recording" ? <Listening seconds={recorder.seconds} onStop={stopRecording} onType={() => void typeInstead()} /> : null}
        {!busy && phase === "question" ? (
          typing || micProblem ? (
            <AnswerForm onSubmit={(a) => shape(transcript, [...answers, a])} onSpeak={micProblem ? undefined : () => { setTyping(false); void startRecording(true); }} />
          ) : (
            <RecordControl label={m.create.speak.answerSpeak} onClick={() => startRecording(true)} onType={() => setTyping(true)} />
          )
        ) : null}
        {micProblem ? <ErrorCard live="status">{micProblem}</ErrorCard> : null}
        {error ? <ErrorCard>{error}</ErrorCard> : null}
      </CreateScreen>
    );
  }

  // ---- idea (boards 2026:3067 listening, 2026:3135 microphone off)
  const typingOpen = phase === "idle" && (typing || !!micProblem);
  const footer = phase === "review" ? (
    <>
      <Button block onClick={() => shape(transcript, [])} disabled={busy}>{m.create.speak.done}</Button>
      <Button block variant="secondary" arrow={false} onClick={() => { setTranscript(""); setPhase("idle"); setTyping(false); }}>{m.create.speak.redo}</Button>
    </>
  ) : typingOpen ? (
    <Button type="submit" form={IDEA_FORM} block disabled={!transcript.trim()}>{m.common.next}</Button>
  ) : null;

  return (
    <CreateScreen back="/create/method" step={3} title={m.create.speak.title} lead={phase === "idle" || phase === "recording" ? m.create.speak.hint : undefined} footer={footer}>
      {micProblem ? <ErrorCard live="status">{micProblem}</ErrorCard> : null}
      {phase === "recording" ? <Listening seconds={recorder.seconds} onStop={stopRecording} onType={() => void typeInstead()} /> : null}
      {busyLine}
      {phase === "review" ? (
        <InfoCard eyebrow={m.create.speak.youSaid}>
          <Field multiline rows={3} label={m.create.speak.textLabel} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        </InfoCard>
      ) : null}
      {phase === "idle" ? (
        typingOpen ? (
          <form id={IDEA_FORM} className={styles.form} onSubmit={(e) => { e.preventDefault(); if (transcript.trim()) setPhase("review"); }}>
            <Field multiline rows={4} autoFocus={typing} label={m.create.speak.textLabel} placeholder={m.create.speak.textPlaceholder} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
            {!micProblem ? <TextAction onClick={() => setTyping(false)}>{m.create.speakInstead}</TextAction> : null}
          </form>
        ) : (
          <RecordControl label={m.create.speak.start} onClick={() => startRecording(false)} onType={() => setTyping(true)} />
        )
      ) : null}
      {error ? <ErrorCard>{error}</ErrorCard> : null}
    </CreateScreen>
  );
}

const IDEA_FORM = "speak-idea-form";

/** Underlined text action, centred (44 px target). */
function TextAction({ onClick, children }: { onClick: () => void; children: string }) {
  return <Button variant="ghost" arrow={false} className={styles.textAction} onClick={onClick}>{children}</Button>;
}

/** The big 84 px record button with its visible label, and "Type instead" under it. */
function RecordControl({ label, onClick, onType }: { label: string; onClick: () => void; onType: () => void }) {
  return (
    <div className={styles.recordWrap}>
      <button type="button" className={styles.record} onClick={onClick} aria-label={label}><MicIcon /></button>
      <span aria-hidden="true">{label}</span>
      <TextAction onClick={onType}>{m.create.typeInstead}</TextAction>
    </div>
  );
}

/** Recording: the LISTENING card, the visible seconds, the green Stop button, Type instead. No bar. */
function Listening({ seconds, onStop, onType }: { seconds: number; onStop: () => void; onType: () => void }) {
  return (
    <>
      <div role="status"><InfoCard eyebrow={m.create.speak.listening}><p>{m.create.speak.listeningHint}</p></InfoCard></div>
      <div className={styles.recordWrap}>
        <p className={styles.seconds}>{fmt(m.create.speak.seconds, { s: seconds })}</p>
        <button type="button" className={styles.record} data-recording="true" onClick={onStop} aria-label={m.create.speak.stop}><StopIcon /></button>
        <span aria-hidden="true">{m.create.speak.stop}</span>
        <TextAction onClick={onType}>{m.create.typeInstead}</TextAction>
      </div>
    </>
  );
}

/** Typed answer to the clarifying question (shown after Type instead, or when the mic is off). */
function AnswerForm({ onSubmit, onSpeak }: { onSubmit: (answer: string) => void; onSpeak?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}>
      <Field autoFocus label={m.create.speak.answerLabel} value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" block disabled={!value.trim()}>{m.create.speak.answerSubmit}</Button>
      {onSpeak ? <TextAction onClick={onSpeak}>{m.create.speakInstead}</TextAction> : null}
    </form>
  );
}
