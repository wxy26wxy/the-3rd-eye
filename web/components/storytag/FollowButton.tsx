"use client";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, HeartIcon } from "@/components/ui/Icons";

const KEY = "ms:follow";
const listeners = new Set<() => void>();
function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Follow is saved on this device only (no accounts for buyers yet). */
export function FollowButton({ creatorId, label, followingLabel, note }: { creatorId: string; label: string; followingLabel: string; note: string }) {
  const following = useSyncExternalStore(subscribe, () => read().includes(creatorId), () => false);
  return (
    <div>
      <Button
        variant="secondary"
        arrow={false}
        aria-pressed={following}
        icon={following ? <CheckIcon /> : <HeartIcon />}
        onClick={() => {
          const list = read().filter((id) => id !== creatorId);
          if (!following) list.push(creatorId);
          try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
          listeners.forEach((l) => l());
        }}
      >
        {following ? followingLabel : label}
      </Button>
      {following ? <p className="visually-hidden" role="status">{note}</p> : null}
    </div>
  );
}
