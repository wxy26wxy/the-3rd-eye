"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button, ButtonFace } from "@/components/ui/Button";
import { CameraIcon, ImageIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { MascotPicture } from "../art";
import { api, extFor, HANDLE_UPLOAD_URL, UPLOAD_ACCESS, uuid, type Artwork, type Candidate } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { describeError, ErrorNotice, type ScreenError } from "../errors";
import { afterPhoto } from "../flow";
import { useCreate, useCreator } from "../store";
import styles from "../Create.module.css";

type Phase = "pick" | "uploading" | "finding";


const MAX_SIDE = 4096;
/**
 * Re-encodes the picked picture through a canvas as JPEG: drops EXIF (GPS, device) and applies
 * the orientation. Falls back to the original file when the browser cannot decode it (e.g. HEIC
 * outside Safari); the server deletes the public upload after its private copy either way.
 */
async function stripMetadata(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Take or upload a photo of a drawing → Blob → `POST /artworks {detect:false}` (round 3: the photo is
 * stored, no detection yet; it never answers 422) → Adjust the area on the whole photo.
 */
export function Photo({ mode }: { mode: "camera" | "upload" }) {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { creator, refresh } = useCreator();
  const [phase, setPhase] = useState<Phase>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (ready && !draft.product) return <MissingState />;
  const camera = mode === "camera";

  async function onFile(file: File | undefined) {
    if (!file || !draft.product) return;
    setError(null);
    setLastFile(file);
    setPreview(URL.createObjectURL(file));
    setPhase("uploading");
    try {
      const me = creator ?? (await refresh());
      const creatorId = me?.id ?? "me";
      const clean = await stripMetadata(file);
      const blob = await upload(`creators/${creatorId}/photo/${uuid()}.${extFor(clean, "jpg")}`, clean, {
        access: UPLOAD_ACCESS, handleUploadUrl: HANDLE_UPLOAD_URL, contentType: clean.type || undefined,
      });
      setPhase("finding");
      const res = await api<{ artwork: Artwork; candidates: Candidate[]; imageSize?: { w: number; h: number } | null }>("artworks", { json: { source: "photo", imageUrl: blob.url, product: draft.product, detect: false } });
      afterPhoto({ router, update }, res);
    } catch (err) {
      setError(describeError(err, m.create.photo.error));
    } finally {
      // Also after navigating: this route stays mounted, and coming back must not show "Finding…".
      setPhase("pick");
    }
  }

  const busy = phase !== "pick";
  const busyLabel = phase === "uploading" ? m.create.photo.uploading : m.create.photo.finding;
  const picker = (label: string, variant: "primary" | "secondary" = "primary") => (
    <FilePicker label={label} variant={variant} icon={variant === "secondary" ? (camera ? <CameraIcon /> : <ImageIcon />) : undefined}
      accept="image/*" capture={camera ? "environment" : undefined} onFile={onFile} />
  );
  // Bar per state: the picker (idle, or Retake after an error that calls for it), Try again
  // (time-out or other, board 2038:4419), nothing while working.
  let footer: ReactNode = null;
  if (!busy && error?.action === "retake") {
    footer = picker(m.create.errors.retake);
  } else if (!busy && error?.action === "retry" && lastFile) {
    footer = <Button block onClick={() => void onFile(lastFile)}>{m.create.errors.retry}</Button>;
  } else if (!busy) {
    footer = picker(preview || error ? m.create.photo.retake : camera ? m.create.photo.pickCamera : m.create.photo.pickUpload);
  }

  // Boards 2027:3184 (camera), 2027:3207 (finding), 2027:3226 / 2038:4419 (errors).
  return (
    <CreateScreen back="/create/method" step={3} title={camera ? m.create.photo.titleCamera : m.create.photo.titleUpload} lead={m.create.photo.copy} footer={footer}>
      {busy ? <Loading variant="sky" label={busyLabel} />
        : error ? <ErrorNotice error={error} />
        : preview ? <div className={styles.photoPreview}><ArtImage src={preview} alt={m.create.photo.preview} placeholder="" ratio="auto" /></div>
        : <MascotPicture kind="card" />}
    </CreateScreen>
  );
}

/** A native file input styled as the primary pill (keyboard + screen reader friendly). */
export function FilePicker({ label, icon, accept, capture, onFile, variant = "primary" }: {
  label: string; icon?: ReactNode; accept: string; capture?: "environment" | "user"; onFile: (f: File | undefined) => void; variant?: "primary" | "secondary";
}) {
  return (
    <label className={styles.filePick}>
      <input type="file" accept={accept} capture={capture} aria-label={label} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <ButtonFace variant={variant} block icon={icon} arrow={variant === "primary"}>{label}</ButtonFace>
    </label>
  );
}
