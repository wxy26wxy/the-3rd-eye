"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ORDER_STATUSES, createCreator, rotateCreatorCode as rotateCode, setCreatorHidden as setHidden, updateOrderStatus,
  type IssuedCode, type OrderStatus,
} from "@/lib/db/queries.contract";
import { checkAdminAuth } from "@/lib/admin-auth";
import { fmt, m } from "@/components/messages";
import { siteOrigin } from "@/components/site/origin";
import { safeErrorText } from "@/lib/log-safe";
import { appCodeLink } from "@/lib/app-link";

const TASK = "T070";
const c = m.admin.creators;

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

/** A code just issued, with the links to hand over. Lives only in this response and the admin's page state. */
export type IssuedView = { at: number; message: string; displayName: string; code: string; signInUrl: string; appUrl: string };
export type CreatorState = { error?: string; issued?: IssuedView };

const isAdmin = async () => checkAdminAuth((await headers()).get("authorization")) === "ok";

async function issuedView(issued: IssuedCode, template: string): Promise<IssuedView> {
  const code = encodeURIComponent(issued.code);
  return {
    at: Date.now(),
    message: fmt(template, { name: issued.displayName }),
    displayName: issued.displayName,
    code: issued.code,
    signInUrl: `${await siteOrigin()}/create/code?c=${code}`,
    appUrl: appCodeLink(issued.code),
  };
}

/** Admin: add a studio-issued creator and show their code once. Errors are logged without the code. */
export async function addCreator(_prev: CreatorState, formData: FormData): Promise<CreatorState> {
  if (!(await isAdmin())) return { error: m.admin.unauthorized };
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const studioName = String(formData.get("studioName") ?? "").trim().slice(0, 120);
  if (!displayName) return { error: c.nameRequired };
  try {
    const issued = await createCreator({
      displayName, studioName: studioName || undefined,
      mentionDisability: formData.get("mentionDisability") === "on", hidden: formData.get("hidden") === "on",
    }, { task: TASK });
    revalidatePath("/admin");
    return { issued: await issuedView(issued, c.added) };
  } catch (err) {
    console.error("addCreator failed", safeErrorText(err));
    return { error: c.error };
  }
}

/** Admin: replace a creator's code (the old code and sign-in link stop working) and show the new one once. */
export async function rotateCreatorCode(_prev: CreatorState, formData: FormData): Promise<CreatorState> {
  if (!(await isAdmin())) return { error: m.admin.unauthorized };
  const creatorId = String(formData.get("creatorId") ?? "");
  try {
    const issued = await rotateCode(creatorId, { task: TASK });
    return { issued: await issuedView(issued, c.rotated) };
  } catch (err) {
    console.error("rotateCreatorCode failed", safeErrorText(err));
    return { error: c.error };
  }
}

/** Admin: hide a creator from the public shop (testing) or show them again. */
export async function setCreatorHidden(_prev: StatusState, formData: FormData): Promise<StatusState> {
  if (!(await isAdmin())) return { error: m.admin.unauthorized };
  const creatorId = String(formData.get("creatorId") ?? "");
  const hidden = formData.get("hidden") === "true";
  try {
    await setHidden(creatorId, hidden, { task: TASK });
  } catch (err) {
    console.error("setCreatorHidden failed", safeErrorText(err));
    return { error: c.error };
  }
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/artists");
  return { ok: true };
}
