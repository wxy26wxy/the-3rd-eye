/**
 * Runs `fn` after the response is sent (Next `after()`), so slow follow-up work (describing a picked cut,
 * cutting the other pieces) does not hold the answer. Outside a request scope (scripts, tests) `after`
 * throws; then `fn` is awaited inline. A failing task is logged, never thrown.
 */
import "server-only";
import { after } from "next/server";

export async function runAfterResponse(fn: () => Promise<unknown>): Promise<void> {
  const task = async () => {
    try { await fn(); } catch (err) { console.warn("[after] background work failed:", err instanceof Error ? err.message : err); }
  };
  try {
    after(task);
  } catch {
    await task();
  }
}
