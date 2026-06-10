import type { Metadata, Viewport } from "next";
import { Crimson_Pro, Cormorant_Garamond } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const crimson = Crimson_Pro({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Second Brain",
  description: "A personal knowledge base built from 150+ books",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${crimson.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <main className="flex-auto min-w-0 flex flex-col px-4 md:px-0">
          <section className="w-full max-w-2xl mx-auto py-8">{children}</section>
        </main>
        <Analytics />
      </body>
    </html>
  );
}
