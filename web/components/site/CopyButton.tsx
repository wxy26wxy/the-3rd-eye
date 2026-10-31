"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CopyIcon } from "@/components/ui/Icons";

/** Secondary "Copy" pill: shows the check and the copied label for two seconds (also announced). */
export function CopyButton({ value, label, copiedLabel, className }: { value: string; label: string; copiedLabel: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        arrow={false}
        className={className}
        icon={copied ? <CheckIcon /> : <CopyIcon />}
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked; the URL is visible to copy by hand */ }
        }}
      >
        {copied ? copiedLabel : label}
      </Button>
      <span role="status" className="visually-hidden">{copied ? copiedLabel : ""}</span>
    </>
  );
}
