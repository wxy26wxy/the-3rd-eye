"use client";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { ChoiceCard, ChoiceGroup } from "@/components/ui/ChoiceCard";
import { useCreate } from "../store";
import { CreateScreen } from "../CreateScreen";
import { ProductGlyph } from "../glyphs";

export function ChooseProduct() {
  const router = useRouter();
  const { draft, update } = useCreate();
  return (
    <CreateScreen
      back="/create"
      step={1}
      title={m.create.product.title}
      footer={<Button block disabled={!draft.product} onClick={() => router.push("/create/method")}>{m.common.next}</Button>}
    >
      <ChoiceGroup legend={m.create.product.groupLabel} layout="grid">
        <ChoiceCard name="product" value="sticker" title={m.create.product.sticker} description={m.create.product.stickerCopy} media={<ProductGlyph type="sticker" />} checked={draft.product === "sticker"} onChange={() => update({ product: "sticker" })} />
        <ChoiceCard name="product" value="tote" title={m.create.product.tote} description={m.create.product.toteCopy} media={<ProductGlyph type="tote" />} checked={draft.product === "tote"} onChange={() => update({ product: "tote" })} />
      </ChoiceGroup>
    </CreateScreen>
  );
}
