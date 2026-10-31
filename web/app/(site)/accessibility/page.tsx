import type { Metadata } from "next";
import { m } from "@/components/messages";
import { StaticPage } from "@/components/pages/StaticPage";

export const metadata: Metadata = { title: m.a11y.metaTitle };

export default function AccessibilityPage() {
  return (
    <StaticPage
      title={m.a11y.title}
      intro={m.a11y.intro}
      items={[m.a11y.voiceFirst, m.a11y.spoken, m.a11y.captions, m.a11y.contrast, m.a11y.targets, m.a11y.keyboard, m.a11y.motion]}
      note={m.a11y.feedback}
    />
  );
}
