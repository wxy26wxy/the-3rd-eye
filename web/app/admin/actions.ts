"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ORDER_STATUSES, updateOrderStatus, type OrderStatus } from "@/lib/db/queries.contract";
import { checkAdminAuth } from "@/lib/admin-auth";
import { m } from "@/components/messages";

export type StatusState = { error?: string; ok?: boolean };

/**
 * Admin: move an order to a status. Server Functions can be reached by a direct POST, so this
 * verifies the basic-auth header itself (the browser resends cached credentials for /admin);
 * the proxy guard alone is not enough.
 */
export async function setOrderStatus(_prev: StatusState, formData: FormData): Promise<StatusState> {
  if (checkAdminAuth((await headers()).get("authorization")) !== "ok") return { error: m.admin.unauthorized };
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!orderId || !ORDER_STATUSES.includes(status)) return { error: m.admin.statusError };
  try {
    await updateOrderStatus(orderId, status, { task: "T020" });
  } catch (err) {
    console.error("setOrderStatus failed", err);
    return { error: m.admin.statusError };
  }
  revalidatePath("/admin");
  return { ok: true };
}
