import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { sampleWedding } from "@/lib/wedding-data";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Wedding Flow Studio",
  title: {
    default: "Wedding Flow Studio | Wedding Day Digital Twin",
    template: "%s | Wedding Flow Studio"
  },
  description:
    "A premium visual wedding-day production studio for previewing ceremony flow, reception timing, music cues, seating, vendors, role briefs, and the full run of show before the day unfolds.",
  keywords: [
    "wedding planning",
    "wedding day timeline",
    "run of show",
    "wedding production",
    "vendor brief",
    "ceremony layout",
    "reception seating",
    "music cue sheet",
    "director mode"
  ],
  openGraph: {
    description:
      "Preview the wedding day before it unfolds with a visual production studio for ceremony, reception, cues, guests, vendors, and role handoffs.",
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
      "A premium visual wedding-day production studio for previews, timelines, cues, vendors, seating, and role-specific briefs.",
    title: "Wedding Flow Studio"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell wedding={sampleWedding}>{children}</AppShell>
      </body>
    </html>
  );
}
