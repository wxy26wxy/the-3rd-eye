"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createOrder } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";

/** Where an error belongs on the form: under the name or the note field, or above the button. */
export type BuyErrorField = "name" | "note" | "form";
/** Every failure says where it goes: `error` and `field` come together or not at all. */
export type BuyState = { values?: { buyerName: string; buyerEmail: string; shipNote: string; size: string; quantity: string } } &
  ({ error?: undefined; field?: undefined } | { error: string; field: BuyErrorField });

const schema = z.object({
  buyerName: z.string().trim().min(1).max(120),
  buyerEmail: z.union([z.literal(""), z.email().max(200)]),
  shipNote: z.string().trim().max(500),
  /** Sticker size key ("3in" | "4in" | "sheet"); empty = the product's default. Checked against the product in placeOrder. */
  size: z.union([z.literal(""), z.enum(["3in", "4in", "sheet"])]),
  /** Stepper value; empty = 1. */
  quantity: z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]),
});

/** Server action: staged checkout. Creates the order (and its story tag), then shows the confirmation. */
export async function placeOrder(productId: string, _prev: BuyState, formData: FormData): Promise<BuyState> {
  const raw = {
    buyerName: String(formData.get("buyerName") ?? ""),
    buyerEmail: String(formData.get("buyerEmail") ?? "").trim(),
    shipNote: String(formData.get("shipNote") ?? ""),
    size: String(formData.get("size") ?? "").trim(),
    quantity: String(formData.get("quantity") ?? "").trim(),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const nameBad = parsed.error.issues.some((i) => i.path[0] === "buyerName");
    if (nameBad) return { values: raw, field: "name", error: m.product.nameRequired };
    const lineBad = parsed.error.issues.some((i) => i.path[0] === "size" || i.path[0] === "quantity");
    return { values: raw, field: "form", error: lineBad ? m.product.sizeInvalid : m.product.buyError };
  }
  let orderId: string;
  try {
    const res = await createOrder(productId, {
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail || undefined,
      shipNote: parsed.data.shipNote || undefined,
      size: parsed.data.size || undefined,
      quantity: parsed.data.quantity === "" ? 1 : parsed.data.quantity,
    }, { task: "T111" });
    orderId = res.orderId;
  } catch (err) {
    if ((err as { code?: string })?.code === "note_rejected") return { values: raw, field: "note", error: m.product.noteRejected };
    if ((err as { code?: string })?.code === "invalid_size" || (err as { code?: string })?.code === "invalid_request") return { values: raw, field: "form", error: m.product.sizeInvalid };
    if ((err as { code?: string })?.code === "moderation_unavailable") return { values: raw, field: "note", error: m.product.noteUnavailable };
    console.error("placeOrder failed", err);
    return { values: raw, field: "form", error: m.product.buyError };
  }
  redirect(`/buy/success?order=${encodeURIComponent(orderId)}`);
}
