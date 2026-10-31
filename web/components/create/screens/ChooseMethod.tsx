"use client";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { ChoiceCard, ChoiceGroup } from "@/components/ui/ChoiceCard";
import { CameraIcon, MicIcon, UploadIcon } from "@/components/ui/Icons";
import { useCreate, type Draft } from "../store";
import { CreateScreen, MissingState } from "../CreateScreen";

const NEXT: Record<NonNullable<Draft["method"]>, string> = { photo: "/create/photo?mode=camera", upload: "/create/photo?mode=upload", voice: "/create/speak" };

export function ChooseMethod() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  if (ready && !draft.product) return <MissingState />;
  const method = draft.method;
  return (
    <CreateScreen
      back="/create/product"
      step={2}
      title={m.create.method.title}
      footer={<Button block disabled={!method} onClick={() => method && router.push(NEXT[method])}>{m.common.next}</Button>}
    >
      <ChoiceGroup legend={m.create.method.title}>
        <ChoiceCard name="method" value="photo" title={m.create.method.photo} description={m.create.method.photoCopy} media={<CameraIcon />} checked={method === "photo"} onChange={() => update({ method: "photo" })} />
        <ChoiceCard name="method" value="upload" title={m.create.method.upload} description={m.create.method.uploadCopy} media={<UploadIcon />} checked={method === "upload"} onChange={() => update({ method: "upload" })} />
        <ChoiceCard name="method" value="voice" title={m.create.method.speak} description={m.create.method.speakCopy} media={<MicIcon />} checked={method === "voice"} onChange={() => update({ method: "voice" })} badge={m.create.method.badge} />
      </ChoiceGroup>
    </CreateScreen>
  );
}
