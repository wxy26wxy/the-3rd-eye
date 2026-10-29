"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { CameraIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { api, type Artwork } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { makeProduct, useCreate } from "../store";
import { VariantPicker } from "./VariantPicker";

/** SAM found several drawings: the creator taps the one they want. */
export function Select() {
  const router = useRouter();
  const { ready, draft } = useCreate();
  const [choice, setChoice] = useState<string | undefined>(draft.candidates?.[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (ready && (!draft.photoArtworkId || !draft.candidates?.length || !draft.product)) return <MissingState />;
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";

  async function useThis() {
    if (!choice || !draft.photoArtworkId || !draft.product) return;
    setBusy(true);
    setError(null);
    try {
      const art = await api<Artwork>(`artworks/${draft.photoArtworkId}/select`, { json: { candidateId: choice } });
      await makeProduct(art.id, draft.product);
      router.push("/create/ready");
    } catch {
      setError(m.create.errorGeneric);
      setBusy(false);
    }
  }

  return (
    <CreateScreen
      back={retake}
      step={3}
      title={m.create.select.title}
      lead={m.create.select.copy}
      footer={busy ? null : (
        <>
          <Button block onClick={useThis} disabled={!choice}>{m.create.select.use}</Button>
          <Button block variant="secondary" arrow={false} icon={<CameraIcon />} href={retake}>{m.create.select.retake}</Button>
        </>
      )}
    >
      {busy ? <Loading label={fmt(m.create.result.making, { product: draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase() })} /> : null}
      {error ? <Status tone="error">{error}</Status> : null}
      <VariantPicker
        name="candidate"
        legend={m.create.select.groupLabel}
        items={(draft.candidates ?? []).map((c, i) => ({ id: c.id, src: c.thumbUrl, alt: fmt(m.create.select.candidate, { n: i + 1 }) }))}
        selected={choice}
        onSelect={setChoice}
        itemLabel={m.create.select.candidate}
        placeholder={m.common.imageMissing}
      />
    </CreateScreen>
  );
}
