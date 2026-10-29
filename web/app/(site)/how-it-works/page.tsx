import type { Metadata } from "next";
import { m } from "@/components/messages";
import { StaticPage } from "@/components/pages/StaticPage";
import { HowSteps } from "@/components/shop/HowSteps";

export const metadata: Metadata = { title: m.how.metaTitle };

export default function HowItWorksPage() {
  return (
    <StaticPage title={m.how.title} intro={m.how.intro} items={[m.how.draw, m.how.speak, m.how.print, m.how.tap, m.how.earn]}>
      <HowSteps id="story-tags" />
    </StaticPage>
  );
}
