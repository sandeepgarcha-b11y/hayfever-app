import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hayfever Dashboard",
  description: "Real-time weather, pollen levels, and personalised daily recommendations",
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
