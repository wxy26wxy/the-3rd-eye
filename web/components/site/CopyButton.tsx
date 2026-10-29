"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CopyIcon } from "@/components/ui/Icons";

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        arrow={false}
        icon={copied ? <CheckIcon /> : <CopyIcon />}
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked; the URL is visible to copy by hand */ }
        }}
      >
        {label}
      </Button>
      <span role="status" className="visually-hidden">{copied ? copiedLabel : ""}</span>
    </>
  );
}
