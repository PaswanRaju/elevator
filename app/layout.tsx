import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "the-elevator.vercel.app"}`,
  ),
  title: "THE ELEVATOR — Somewhere else awaits.",
  description:
    "Some doors lead somewhere else. Step inside a cinematic elevator with thirteen unexpected worlds to discover.",
  openGraph: {
    title: "THE ELEVATOR",
    description: "Thirteen floors. Thirteen unexpected worlds. Step inside.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#080b10",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
