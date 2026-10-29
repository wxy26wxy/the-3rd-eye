"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { ButtonFace } from "@/components/ui/Button";
import { CameraIcon, UploadIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { api, extFor, HANDLE_UPLOAD_URL, UPLOAD_ACCESS, uuid, type Artwork, type Candidate } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { makeProduct, useCreate, useCreator } from "../store";
import styles from "../Create.module.css";

type Phase = "pick" | "uploading" | "finding" | "making";

/** Take or upload a photo of a drawing → Blob → POST /artworks (SAM finds the drawings). */
export function Photo({ mode }: { mode: "camera" | "upload" }) {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { creator, refresh } = useCreator();
  const [phase, setPhase] = useState<Phase>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (ready && !draft.product) return <MissingState />;
  const camera = mode === "camera";

  async function onFile(file: File | undefined) {
    if (!file || !draft.product) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setPhase("uploading");
    try {
      const me = creator ?? (await refresh());
      const creatorId = me?.id ?? "me";
      const blob = await upload(`creators/${creatorId}/originals/${uuid()}.${extFor(file, "jpg")}`, file, {
        access: UPLOAD_ACCESS, handleUploadUrl: HANDLE_UPLOAD_URL, contentType: file.type || undefined,
      });
      setPhase("finding");
      const res = await api<{ artwork: Artwork; candidates: Candidate[] }>("artworks", { json: { source: "photo", imageUrl: blob.url, product: draft.product } });
      if (res.candidates.length > 1 && !res.artwork.cleanedUrl) {
        update({ photoArtworkId: res.artwork.id, candidates: res.candidates, transcript: undefined });
        router.push("/create/select");
        return;
      }
      setPhase("making");
      update({ transcript: undefined });
      await makeProduct(res.artwork.id, draft.product);
      router.push("/create/ready");
    } catch {
      setError(m.create.photo.error);
      setPhase("pick");
    }
  }

  return (
    <CreateScreen back="/create/method" step={3} title={camera ? m.create.photo.titleCamera : m.create.photo.titleUpload} lead={m.create.photo.copy}>
      {preview ? <div className={styles.preview}><ArtImage src={preview} alt={m.create.photo.preview} placeholder="" /></div> : null}
      {phase === "uploading" ? <Loading label={m.create.photo.uploading} /> : null}
      {phase === "finding" ? <Loading label={m.create.photo.finding} /> : null}
      {phase === "making" ? <Loading label={m.create.result.making.replace("{product}", draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase())} /> : null}
      {error ? <Status tone="error">{error}</Status> : null}
      {phase === "pick" ? (
        <FilePicker
          label={preview ? m.create.photo.retake : camera ? m.create.photo.pickCamera : m.create.photo.pickUpload}
          icon={camera ? <CameraIcon /> : <UploadIcon />}
          accept="image/*"
          capture={camera ? "environment" : undefined}
          onFile={onFile}
        />
      ) : null}
    </CreateScreen>
  );
}

/** A native file input styled as the primary pill (keyboard + screen reader friendly). */
export function FilePicker({ label, icon, accept, capture, onFile, variant = "primary" }: {
  label: string; icon: ReactNode; accept: string; capture?: "environment" | "user"; onFile: (f: File | undefined) => void; variant?: "primary" | "secondary";
}) {
  return (
    <label className={styles.filePick}>
      <input type="file" accept={accept} capture={capture} aria-label={label} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <ButtonFace variant={variant} block icon={icon}>{label}</ButtonFace>
    </label>
  );
}
