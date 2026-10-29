"use server";
import { revalidatePath } from "next/cache";
import { ORDER_STATUSES, updateOrderStatus, type OrderStatus } from "@/lib/db/queries.contract";

/** Admin: move an order to a status. The proxy guards /admin with basic auth; server actions post to the page URL, so the same guard applies. */
export async function setOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!orderId || !ORDER_STATUSES.includes(status)) return;
  await updateOrderStatus(orderId, status, { task: "T020" });
  revalidatePath("/admin");
}
