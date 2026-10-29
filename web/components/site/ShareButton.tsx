"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ShareIcon } from "@/components/ui/Icons";

/** Web Share API with a copy-link fallback. */
export function ShareButton({ title, text, label, copiedLabel }: { title: string; text: string; label: string; copiedLabel: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <Button
        variant="secondary"
        arrow={false}
        icon={<ShareIcon />}
        onClick={async () => {
          const url = window.location.href;
          if (navigator.share) {
            try { await navigator.share({ title, text, url }); } catch { /* user cancelled */ }
            return;
          }
          try { await navigator.clipboard.writeText(url); setMsg(copiedLabel); setTimeout(() => setMsg(""), 2500); } catch { /* ignore */ }
        }}
      >
        {label}
      </Button>
      <span role="status" className="visually-hidden">{msg}</span>
    </>
  );
}
