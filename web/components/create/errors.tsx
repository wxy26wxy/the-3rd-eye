"use client";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { ErrorCard } from "./cards";
import { ApiError } from "./api";

/**
 * What the screen should offer next: retry the same call, retake the photo, fix the form, accept a
 * print warning ("Use anyway", contrast), re-do the cutout (resolution), or nothing special.
 */
export type ErrorAction = "retry" | "retake" | "fix" | "accept" | "redo" | "none";
export type ScreenError = { message: string; action: ErrorAction };

/**
 * Turns a failed call into words for the creator. 4xx answers carry a readable reason from the
 * API (docs/api.md), so it is shown as is; 504 means the server ran out of time and can be retried.
 */
export function describeError(err: unknown, fallback: string = m.create.errorGeneric): ScreenError {
  if (err instanceof ApiError) {
    if (err.status === 504 || err.code === "deadline_exceeded") return { message: m.create.errors.timeout, action: "retry" };
    if (err.code === "no_drawing_found") return { message: err.message || m.create.errors.noDrawing, action: "retake" };
    if (err.code === "print_check_failed") {
      // Round 3 ruling 2: contrast is a warning the creator may accept; resolution blocks.
      if (err.extra.check === "contrast") return { message: m.create.errors.printContrast, action: "accept" };
      if (err.extra.check === "resolution") return { message: m.create.errors.printResolution, action: "redo" };
      return { message: fmt(m.create.errors.printCheck, { reason: err.message }), action: "fix" };
    }
    if (err.code === "moderation_failed") return { message: fmt(m.create.errors.moderation, { reason: err.message.replace(/\.?$/, ".") }), action: "fix" };
    if (err.status >= 400 && err.status < 500 && err.status !== 401 && err.message) return { message: err.message, action: "none" };
  }
  return { message: fallback, action: "retry" };
}

/**
 * The error card plus the next step the error calls for, as text actions inside the card
 * (web creator boards: "Try again" under the message). Screens whose board puts the next step in
 * the bottom bar (Photo, Drawing) leave the handlers out and render their own actions.
 */
export function ErrorNotice({ error, onRetry, retakeHref, onRetake, onAccept, onRedo }: {
  error: ScreenError | null; onRetry?: () => void; retakeHref?: string; onRetake?: () => void;
  /** "Use anyway" for a print warning (contrast). */
  onAccept?: () => void;
  /** "Re-do the cutout" when the picture is too small to print (resolution). */
  onRedo?: () => void;
}) {
  if (!error) return null;
  const retry = error.action === "retry" && onRetry
    ? <Button variant="ghost" arrow={false} onClick={onRetry}>{m.create.errors.retry}</Button> : null;
  const retake = error.action !== "retake" ? null
    : retakeHref ? <Button variant="ghost" arrow={false} href={retakeHref}>{m.create.errors.retake}</Button>
    : onRetake ? <Button variant="ghost" arrow={false} onClick={onRetake}>{m.create.errors.retake}</Button> : null;
  const accept = error.action === "accept" && onAccept
    ? <Button variant="ghost" arrow={false} onClick={onAccept}>{m.create.errors.useAnyway}</Button> : null;
  const redo = (error.action === "accept" || error.action === "redo") && onRedo
    ? <Button variant="ghost" arrow={false} onClick={onRedo}>{m.create.errors.redoCutout}</Button> : null;
  const actions = retry || retake || accept || redo ? <>{retry}{retake}{accept}{redo}</> : undefined;
  return <ErrorCard actions={actions}>{error.message}</ErrorCard>;
}
