import type { Metadata } from "next";
import { m } from "@/components/messages";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: m.admin.metaTitle, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
