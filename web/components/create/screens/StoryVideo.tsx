"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Field";
import { UploadIcon, VideoIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { Title } from "@/components/ui/Text";
import { blobToWav } from "@/lib/audio/wav";
import { api, extFor, HANDLE_UPLOAD_URL, UPLOAD_ACCESS, uuid } from "../api";
import { CreateScreen } from "../CreateScreen";
import { describeError, ErrorNotice, type ScreenError } from "../errors";
import { useCreator } from "../store";
import { FilePicker } from "./Photo";
import styles from "../Create.module.css";

const FALLBACK = [m.create.story.prompt1, m.create.story.prompt2, m.create.story.prompt3];
/** Longest soundtrack sent for captions (16 kHz mono WAV is 32 kB/s, so 3 min ≈ 5.8 MB). */
const MAX_CAPTION_SECONDS = 180;

/**
 * Captions need a WAV of the video's soundtrack (Voice Transcribe accepts WAV only and the
 * server has no ffmpeg on Vercel): decode the video's audio in the browser → mono 16 kHz WAV.
 * Returns null when the browser cannot decode this video's audio; the video is still saved.
 */
async function soundtrackWav(file: File): Promise<Blob | null> {
  try {
    return await blobToWav(file, MAX_CAPTION_SECONDS);
  } catch (err) {
    console.warn("Could not read the video's sound for captions", err);
    return null;
  }
}

/** First listing only: record (or choose) a short story video; captions are made by the backend. */
export function StoryVideo() {
  const router = useRouter();
  const { creator, refresh } = useCreator();
  const [prompts, setPrompts] = useState<string[]>(FALLBACK);
  const [file, setFile] = useState<File | null>(null);
  const [mention, setMention] = useState(false);
  const [phase, setPhase] = useState<"pick" | "uploading" | "processing">("pick");
  const [error, setError] = useState<ScreenError | null>(null);

  useEffect(() => {
    let live = true;
    api<{ prompts: string[] }>("creators/me/story-prompts")
      .then((r) => { if (live && r.prompts?.length === 3) setPrompts(r.prompts); })
      .catch(() => { /* keep the built-in prompts */ });
    return () => { live = false; };
  }, []);

  async function submit() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const me = creator ?? (await refresh());
      const base = `creators/${me?.id ?? "me"}`;
      const [blob, audioUrl] = await Promise.all([
        upload(`${base}/story-video/${uuid()}.${extFor(file, "mp4")}`, file, {
          access: UPLOAD_ACCESS, handleUploadUrl: HANDLE_UPLOAD_URL, contentType: file.type || undefined, multipart: file.size > 20 * 1024 * 1024,
        }),
        soundtrackWav(file).then(async (wav) => wav
          ? (await upload(`${base}/audio/${uuid()}.wav`, wav, { access: UPLOAD_ACCESS, handleUploadUrl: HANDLE_UPLOAD_URL, contentType: "audio/wav" })).pathname
          : undefined),
      ]);
      setPhase("processing");
      await api("creators/me/story-video", { json: { videoUrl: blob.pathname, audioUrl, mentionDisability: mention } });
      void refresh();
      router.push("/create/live");
    } catch (err) {
      setError(describeError(err));
      setPhase("pick");
    }
  }

  const busy = phase !== "pick";
  return (
    <CreateScreen
      title={m.create.story.title}
      lead={m.create.story.copy}
      mascot="waving"
      footer={busy ? null : (
        <>
          <Button block onClick={submit} disabled={!file}>{m.create.story.submit}</Button>
          <Button block variant="ghost" arrow={false} href="/create/live">{m.create.story.skip}</Button>
        </>
      )}
    >
      <Card pad="l">
        <Title as="h2" size="m">{m.create.story.promptsTitle}</Title>
        <ol role="list" className={styles.prompts}>{prompts.map((p) => <li key={p}>{p}</li>)}</ol>
      </Card>
      {busy ? <Loading label={phase === "uploading" ? m.create.story.uploading : m.create.story.processing} /> : (
        <div className={styles.footerInner}>
          <FilePicker label={m.create.story.record} icon={<VideoIcon />} accept="video/*" capture="user" onFile={(f) => f && setFile(f)} />
          <FilePicker label={m.create.story.choose} icon={<UploadIcon />} accept="video/mp4,video/quicktime,video/*" variant="secondary" onFile={(f) => f && setFile(f)} />
          {file ? <Status tone="success">{fmt(m.create.story.selected, { name: file.name })}</Status> : null}
        </div>
      )}
      <Card pad="m" tone="white">
        <Switch label={m.create.story.mention} hint={m.create.story.mentionHint} checked={mention} onChange={(e) => setMention(e.target.checked)} disabled={busy} />
      </Card>
      <ErrorNotice error={error} onRetry={() => void submit()} />
    </CreateScreen>
  );
}
