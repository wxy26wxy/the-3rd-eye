import type { Metadata } from "next";
import { m } from "@/components/messages";
import { CreateMain } from "@/components/create/CreateMain";

export const metadata: Metadata = { title: m.create.metaTitle, robots: { index: false } };

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <CreateMain>{children}</CreateMain>;
}
