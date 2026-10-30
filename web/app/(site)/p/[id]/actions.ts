"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createOrder } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";

export type BuyState = { error?: string; nameError?: string; values?: { buyerName: string; buyerEmail: string; shipNote: string } };

const schema = z.object({
  buyerName: z.string().trim().min(1).max(120),
  buyerEmail: z.union([z.literal(""), z.email().max(200)]),
  shipNote: z.string().trim().max(500),
});

/** Server action: staged checkout. Creates the order (and its story tag), then shows the confirmation. */
export async function placeOrder(productId: string, _prev: BuyState, formData: FormData): Promise<BuyState> {
  const raw = {
    buyerName: String(formData.get("buyerName") ?? ""),
    buyerEmail: String(formData.get("buyerEmail") ?? "").trim(),
    shipNote: String(formData.get("shipNote") ?? ""),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const nameBad = parsed.error.issues.some((i) => i.path[0] === "buyerName");
    return { values: raw, nameError: nameBad ? m.product.nameRequired : undefined, error: nameBad ? undefined : m.product.buyError };
  }
  let orderId: string;
  try {
    const res = await createOrder(productId, {
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail || undefined,
      shipNote: parsed.data.shipNote || undefined,
    }, { task: "T050" });
    orderId = res.orderId;
  } catch (err) {
    if ((err as { code?: string })?.code === "note_rejected") return { values: raw, error: m.product.noteRejected };
    if ((err as { code?: string })?.code === "moderation_unavailable") return { values: raw, error: m.product.noteUnavailable };
    console.error("placeOrder failed", err);
    return { values: raw, error: m.product.buyError };
  }
  redirect(`/buy/success?order=${encodeURIComponent(orderId)}`);
}
