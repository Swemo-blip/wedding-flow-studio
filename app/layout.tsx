import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AppShell } from "@/components/app-shell/app-shell";
import { LanguageProvider } from "@/lib/i18n";
import { sampleWedding } from "@/lib/wedding-data";
import "./globals.css";

const displaySerif = Fraunces({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"]
});

const bodySans = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  applicationName: "Wedding Flow Studio",
  title: {
    default: "Wedding Flow Studio | Preview your wedding day",
    template: "%s | Wedding Flow Studio"
  },
  description:
    "A calm, beautiful studio to plan your wedding day and preview it before it unfolds — timeline, guests, seating, budget, music, speeches and vendors, all in one place.",
  keywords: [
    "wedding planning",
    "wedding timeline",
    "wedding budget",
    "guest list",
    "seating plan",
    "wedding checklist",
    "wedding day preview"
  ],
  openGraph: {
    description:
      "Plan your wedding day and preview it before it unfolds — timeline, guests, seating, budget, music and more, all in one calm place.",
    locale: "en_US",
    siteName: "Wedding Flow Studio",
    title: "Wedding Flow Studio | Preview the day before it unfolds",
    type: "website"
  },
  robots: {
    follow: true,
    index: true
  },
  twitter: {
    card: "summary_large_image",
    description:
      "A calm, beautiful studio to plan your wedding day and preview it before it unfolds.",
    title: "Wedding Flow Studio"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${displaySerif.variable} ${bodySans.variable}`} lang="en">
      <body>
        <LanguageProvider>
          <AppShell wedding={sampleWedding}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
