import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Try our tools — interactive demos",
  description:
    "Play with live, editable demos of our products. No sign-up. Each sandbox is yours and resets daily.",
  openGraph: {
    title: "Try our tools — interactive demos",
    description:
      "Play with live, editable demos of our products. No sign-up required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
