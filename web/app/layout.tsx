import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { m } from "@/components/messages";
import "./tokens.css";
import "./globals.css";

// Sky (T100): Inter for both roles (design/tokens.json font.display and font.body). One loader;
// globals.css points --font-display at --nf-body too.
const inter = Inter({ subsets: ["latin"], variable: "--nf-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: m.shop.metaTitle, template: `%s${m.common.listSeparator}${m.common.brand}` },
  description: m.shop.metaDescription,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip-link" href="#main">{m.common.skipToContent}</a>
        {children}
      </body>
    </html>
  );
}
