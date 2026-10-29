"use client";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { CameraIcon } from "@/components/ui/Icons";
import { Status } from "@/components/ui/Loading";
import { ApiError } from "./api";

/** What the screen should offer next: retry the same call, retake the photo, fix the form, or nothing special. */
export type ErrorAction = "retry" | "retake" | "fix" | "none";
export type ScreenError = { message: string; action: ErrorAction };

/**
 * Turns a failed call into words for the creator. 4xx answers carry a readable reason from the
 * API (docs/api.md), so it is shown as is; 504 means the server ran out of time and can be retried.
 */
export function describeError(err: unknown, fallback: string = m.create.errorGeneric): ScreenError {
  if (err instanceof ApiError) {
    if (err.status === 504 || err.code === "deadline_exceeded") return { message: m.create.errors.timeout, action: "retry" };
    if (err.code === "no_drawing_found") return { message: err.message || m.create.errors.noDrawing, action: "retake" };
    if (err.code === "print_check_failed") return { message: fmt(m.create.errors.printCheck, { reason: err.message }), action: "fix" };
    if (err.code === "moderation_failed") return { message: fmt(m.create.errors.moderation, { reason: err.message.replace(/\.?$/, ".") }), action: "fix" };
    if (err.status >= 400 && err.status < 500 && err.status !== 401 && err.message) return { message: err.message, action: "none" };
  }
  return { message: fallback, action: "retry" };
}

/** The error line plus the next step the error calls for. */
export function ErrorNotice({ error, onRetry, retakeHref, onRetake }: {
  error: ScreenError | null; onRetry?: () => void; retakeHref?: string; onRetake?: () => void;
}) {
  if (!error) return null;
  return (
    <>
      <Status tone="error">{error.message}</Status>
      {error.action === "retry" && onRetry ? <Button block variant="secondary" arrow={false} onClick={onRetry}>{m.create.errors.retry}</Button> : null}
      {error.action === "retake" && retakeHref ? (
        <Button block variant="secondary" arrow={false} icon={<CameraIcon />} href={retakeHref}>{m.create.errors.retake}</Button>
      ) : error.action === "retake" && onRetake ? (
        <Button block variant="secondary" arrow={false} icon={<CameraIcon />} onClick={onRetake}>{m.create.errors.retake}</Button>
      ) : null}
    </>
  );
}
