import type { Metadata, Viewport } from "next";
import { Bagel_Fat_One, Rubik } from "next/font/google";
import { m } from "@/components/messages";
import "./tokens.css";
import "./globals.css";

const display = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--nf-display", display: "swap" });
const body = Rubik({ weight: ["400", "500", "600", "700", "800"], subsets: ["latin"], variable: "--nf-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: m.shop.metaTitle, template: `%s · ${m.common.brand}` },
  description: m.shop.metaDescription,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip-link" href="#main">{m.common.skipToContent}</a>
        {children}
      </body>
    </html>
  );
}
