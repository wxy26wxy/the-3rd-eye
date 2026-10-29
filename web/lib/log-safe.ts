/**
 * Error text that is safe to log. Drizzle query errors read "Failed query: …\nparams: …", and
 * the params can hold a creator login code (sign-in, add creator, new code); they are cut off.
 */
export function safeErrorText(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const cause = (err as { cause?: { code?: string } } | null)?.cause?.code;
  return text.replace(/\bparams:[\s\S]*$/, "params: [redacted]") + (cause ? ` (${cause})` : "");
}
