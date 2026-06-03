import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "screenshot.local — paste, annotate, copy",
  description:
    "Paste a screenshot, annotate it, copy back to clipboard. 100% client-side. Nothing uploads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
