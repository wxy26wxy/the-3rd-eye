"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field, Switch } from "@/components/ui/Field";
import { CheckIcon, UploadIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { Title } from "@/components/ui/Text";
import { blobToWav } from "@/lib/audio/wav";
import { api, extFor, HANDLE_UPLOAD_URL, UPLOAD_ACCESS, uuid, type Creator, type StoryDraft } from "../api";
import { InfoCard } from "../cards";
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

/** Where "Record again" (R6) came from and returns to after saving. */
export const STORY_REDO_RETURN = "/create/product";

/**
 * Record (or choose) a short story video; captions are made by the backend. After the first listing
 * it goes on to You're live; in `redo` mode ("Record again" on My story video, R6) it replaces the
 * video on every product and returns to Choose a product.
 */
export function StoryVideo({ redo = false }: { redo?: boolean }) {
  const router = useRouter();
  const done = redo ? STORY_REDO_RETURN : "/create/live";
  const { creator, refresh } = useCreator();
  const [prompts, setPrompts] = useState<string[]>(FALLBACK);
  const [file, setFile] = useState<File | null>(null);
  // Record again starts from the creator's current choice; the first video starts with it off.
  const [mentionPick, setMention] = useState<boolean | null>(null);
  const mention = mentionPick ?? (redo ? creator?.mentionDisability ?? false : false);
  const [phase, setPhase] = useState<"pick" | "uploading" | "processing" | "draft" | "editing" | "saving">("pick");
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [storyText, setStoryText] = useState("");
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
      const updated = await api<Creator>("creators/me/story-video", { json: { videoUrl: blob.pathname, audioUrl, mentionDisability: mention } });
      void refresh();
      if (updated.storyDraft?.story_text) {
        // Glimmer stage: offer the story drafted from the creator's own words (Use / Edit / Skip).
        setDraft(updated.storyDraft);
        setStoryText(updated.storyDraft.story_text);
        setPhase("draft");
        return;
      }
      router.push(done);
    } catch (err) {
      setError(describeError(err));
      setPhase("pick");
    }
  }

  async function saveStory(text: string) {
    setError(null);
    setPhase("saving");
    try {
      await api("creators/me", { method: "PUT", json: { storyText: text.trim(), ...(draft?.bio_short ? { bioShort: draft.bio_short } : {}) } });
      void refresh();
      router.push(done);
    } catch (err) {
      setError(describeError(err));
      setPhase("editing");
    }
  }
  function skipStory() {
    void api("creators/me", { method: "PUT", json: { dismissStoryDraft: true } }).catch(() => undefined);
    router.push(done);
  }

  // Draft (boards 2030:3931, editing 2038:4510): the story drafted from the creator's own words.
  if (draft && (phase === "draft" || phase === "editing" || phase === "saving")) {
    const editing = phase === "editing";
    return (
      <CreateScreen
        title={m.create.story.draftTitle}
        lead={m.create.story.draftCopy}
        footer={phase === "saving" ? null : editing ? (
          <>
            <Button block onClick={() => void saveStory(storyText)} disabled={!storyText.trim()}>{m.create.story.draftSave}</Button>
            <Button block variant="secondary" arrow={false} onClick={skipStory}>{m.create.story.draftSkip}</Button>
          </>
        ) : (
          <>
            <Button block onClick={() => void saveStory(draft.story_text)}>{m.create.story.draftUse}</Button>
            <Button block variant="secondary" arrow={false} onClick={() => setPhase("editing")}>{m.create.story.draftEdit}</Button>
            <Button block variant="secondary" arrow={false} onClick={skipStory}>{m.create.story.draftSkip}</Button>
          </>
        )}
      >
        {phase === "saving" ? <Loading inline label={m.create.story.draftSaving} /> : null}
        {editing ? (
          <Field multiline rows={8} maxLength={4000} label={m.create.story.draftLabel} value={storyText} onChange={(e) => setStoryText(e.target.value)} />
        ) : (
          <>
            <InfoCard tone="alt" eyebrow={m.create.story.draftLabel}>
              <Title as="h2" size="l">{draft.headline}</Title>
              <p>{draft.story_text}</p>
            </InfoCard>
            <p className={styles.byline}>{draft.provider === "ollama" ? m.create.story.draftByGlimmer : m.create.story.draftBySpark}</p>
          </>
        )}
        <ErrorNotice error={error} />
      </CreateScreen>
    );
  }

  // Record or choose (boards 2030:3884, video selected 2038:4469). First listing: logo, no Back.
  // Record again: Back returns to Choose a product.
  const busy = phase !== "pick";
  return (
    <CreateScreen
      back={redo && !busy ? STORY_REDO_RETURN : undefined}
      title={redo ? m.create.myStory.title : m.create.story.title}
      lead={redo ? m.create.myStory.replaceNote : m.create.story.copy}
      footer={(
        <>
          <Button block onClick={submit} disabled={!file || busy}>{m.create.story.submit}</Button>
          {busy || redo ? null : <Button block variant="secondary" arrow={false} href={done}>{m.create.story.skip}</Button>}
        </>
      )}
    >
      {file || busy ? null : (
        <div className={styles.prompts}>
          <Title as="h2" size="m">{m.create.story.promptsTitle}</Title>
          <ol role="list" className={styles.promptList}>
            {prompts.map((p, i) => <li key={p}><span className={styles.promptNum} aria-hidden="true">{i + 1}</span><span>{p}</span></li>)}
          </ol>
        </div>
      )}
      {busy ? <Loading inline label={phase === "uploading" ? m.create.story.uploading : m.create.story.processing} /> : null}
      {file || busy ? null : <MentionCard mention={mention} setMention={setMention} disabled={busy} />}
      {busy ? null : (
        <>
          <FilePicker label={m.create.story.record} accept="video/*" capture="user" onFile={(f) => f && setFile(f)} />
          <FilePicker label={m.create.story.choose} icon={<UploadIcon />} accept="video/mp4,video/quicktime,video/*" variant="secondary" onFile={(f) => f && setFile(f)} />
        </>
      )}
      {file && !busy ? <p className={styles.ready} role="status"><span aria-hidden="true" className={styles.printIcon}><CheckIcon /></span>{fmt(m.create.story.selected, { name: file.name })}</p> : null}
      {file && !busy ? <MentionCard mention={mention} setMention={setMention} disabled={busy} /> : null}
      <ErrorNotice error={error} onRetry={() => void submit()} />
    </CreateScreen>
  );
}

function MentionCard({ mention, setMention, disabled }: { mention: boolean; setMention: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className={styles.switchCard}>
      <Switch label={m.create.story.mention} hint={m.create.story.mentionHint} checked={mention} onChange={(e) => setMention(e.target.checked)} disabled={disabled} />
    </div>
  );
}
