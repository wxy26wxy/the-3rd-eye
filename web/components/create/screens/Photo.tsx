"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { ButtonFace } from "@/components/ui/Button";
import { CameraIcon, ImageIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { MascotPicture } from "../art";
import { uuid } from "../api";
import { NoticeCard } from "../cards";
import { CreateScreen, MissingState } from "../CreateScreen";
import { imageSizeOf } from "../crop";
import { ErrorNotice, type ScreenError } from "../errors";
import { afterPhoto } from "../flow";
import { putPhoto } from "../localPhoto";
import { useCreate } from "../store";
import styles from "../Create.module.css";

/**
 * Take or upload a photo of a drawing (round 4 ruling 1): the photo stays on the device. Its size is
 * read (orientation applied) and Adjust the area opens on it at once; nothing is uploaded until "Use
 * this area" uploads the crop. A picture the browser cannot open (e.g. HEIC outside Safari) asks for
 * another one. After a reload lost the photo, this screen says to pick it again.
 */
export function Photo({ mode }: { mode: "camera" | "upload" }) {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const [opening, setOpening] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (ready && !draft.product) return <MissingState />;
  const camera = mode === "camera";

  async function onFile(file: File | undefined) {
    if (!file || !draft.product) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setOpening(true);
    try {
      const size = await imageSizeOf(file);
      const key = uuid();
      putPhoto(key, file);
      afterPhoto({ router, update }, { key, size });
    } catch {
      setError({ message: m.create.photo.cannotOpen, action: "none" });
    } finally {
      // Also after navigating: this route stays mounted, and coming back must not show the busy line.
      setOpening(false);
    }
  }

  const picker = (label: string, variant: "primary" | "secondary" = "primary") => (
    <FilePicker label={label} variant={variant} icon={variant === "secondary" ? (camera ? <CameraIcon /> : <ImageIcon />) : undefined}
      accept="image/*" capture={camera ? "environment" : undefined} onFile={onFile} />
  );
  const footer: ReactNode = opening ? null
    : picker(preview || error ? m.create.photo.retake : camera ? m.create.photo.pickCamera : m.create.photo.pickUpload);

  // Boards 2027:3184 (camera), 2027:3226 / 2038:4419 (errors).
  return (
    <CreateScreen back="/create/method" step={3} title={camera ? m.create.photo.titleCamera : m.create.photo.titleUpload} lead={m.create.photo.copy} footer={footer}>
      {draft.photoLost && !opening && !error ? <NoticeCard>{m.create.photo.lost}</NoticeCard> : null}
      {opening ? <Loading label={m.create.photo.opening} />
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
