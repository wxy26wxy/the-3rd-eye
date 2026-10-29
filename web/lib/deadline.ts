/**
 * Request-scoped deadlines. `withDeadline(ms, fn)` runs `fn` with an AbortSignal stored in
 * AsyncLocalStorage; model clients combine it with their per-call timeout via `callSignal()`.
 * When the deadline passes, `withDeadline` rejects with DeadlineError immediately (even if a
 * provider ignores the signal) so the route can answer before the platform kills the function.
 * Pipelines register the rows they create with `trackArtwork` so a timeout can name them.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type Ctx = { signal: AbortSignal; artworkIds: string[] };
const als = new AsyncLocalStorage<Ctx>();

export class DeadlineError extends Error {
  constructor(public artworkIds: string[]) {
    super("This is taking too long. Your artwork was saved as a draft; try again.");
  }
}

export function currentSignal(): AbortSignal | undefined {
  return als.getStore()?.signal;
}

/** Per-call signal: aborts at `timeoutMs` or at the request deadline, whichever comes first. */
export function callSignal(timeoutMs: number): AbortSignal {
  const ctx = currentSignal();
  const t = AbortSignal.timeout(timeoutMs);
  return ctx ? AbortSignal.any([t, ctx]) : t;
}

export function trackArtwork(id: string): void {
  const ids = als.getStore()?.artworkIds;
  if (ids && !ids.includes(id)) ids.push(id);
}

export function trackedArtworks(): string[] {
  return [...(als.getStore()?.artworkIds ?? [])];
}

export async function withDeadline<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const ctx: Ctx = { signal: controller.signal, artworkIds: [] };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new DeadlineError([...ctx.artworkIds]);
      controller.abort(err);
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([als.run(ctx, fn), expired]);
  } finally {
    clearTimeout(timer);
  }
}
