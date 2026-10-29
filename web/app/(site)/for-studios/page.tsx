import type { Metadata } from "next";
import { m } from "@/components/messages";
import { StaticPage } from "@/components/pages/StaticPage";

export const metadata: Metadata = { title: m.studios.metaTitle };

export default function ForStudiosPage() {
  return <StaticPage title={m.studios.title} intro={m.studios.intro} items={[m.studios.point1, m.studios.point2, m.studios.point3, m.studios.point4]} note={m.studios.contact} pose="cheering" />;
}
