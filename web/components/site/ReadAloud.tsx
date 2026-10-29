"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { SpeakerIcon, StopIcon } from "@/components/ui/Icons";
import { canSpeak, speak, stopSpeaking } from "@/components/speech";

const noopSubscribe = () => () => {};

/** Reads `text` aloud with the device voice. Labels come from the server (messages/en.json). */
export function ReadAloud({ text, label, stopLabel, unsupportedLabel, variant = "secondary", block }: {
  text: string; label: string; stopLabel: string; unsupportedLabel: string; variant?: "primary" | "secondary"; block?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const supported = useSyncExternalStore(noopSubscribe, canSpeak, () => true);
  useEffect(() => () => stopSpeaking(), []);
  if (!supported) return <p>{unsupportedLabel}</p>;
  return (
    <Button
      variant={variant}
      arrow={false}
      block={block}
      icon={speaking ? <StopIcon /> : <SpeakerIcon />}
      aria-pressed={speaking}
      onClick={() => {
        if (speaking) { stopSpeaking(); setSpeaking(false); return; }
        setSpeaking(true);
        speak(text, { onEnd: () => setSpeaking(false) });
      }}
    >
      {speaking ? stopLabel : label}
    </Button>
  );
}
