import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FocusMate — Make room to focus",
  description: "A calm, private workspace for focus sessions, Pomodoro cycles, and personal productivity insights.",
  applicationName: "FocusMate",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
