"use client";
import { useEffect } from "react";

const tapped = new Set<string>();

/** Fires the tap action once per page load (guarded against effect re-runs). */
export function TapOnce({ token, onTap }: { token: string; onTap: (token: string) => Promise<void> }) {
  useEffect(() => {
    if (tapped.has(token)) return;
    tapped.add(token);
    void onTap(token);
  }, [token, onTap]);
  return null;
}
