import type { Metadata } from "next";
import { m } from "@/components/messages";
import { StaticPage } from "@/components/pages/StaticPage";

export const metadata: Metadata = { title: m.how.metaTitle };

/** How it works (board 2025:2682). `#story-tags` (footer link) lands on the "Tap the story tag…" point. */
export default function HowItWorksPage() {
  return <StaticPage title={m.how.title} intro={m.how.intro} items={[m.how.draw, m.how.speak, m.how.print, { text: m.how.tap, id: "story-tags" }, m.how.earn]} />;
}
