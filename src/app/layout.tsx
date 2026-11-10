import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMEIL — Open Multi-Agent Emergence & Investigation Laboratory",
  description:
    "Local-first Scientific Operating System for counterfactual causal experiments, adversarial red-team validation, instrument calibration, and reproducible multi-agent research.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
