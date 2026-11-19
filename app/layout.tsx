import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteHeader } from "@/components/brand/site-header";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Quizzle — Turn your notes into quizzes, verified",
  description:
    "Paste lecture notes, upload a PDF or snap photos — Quizzle writes MCQs, short answers and flashcards, then verifies every answer against your notes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <Providers>
          <a
            href="#main"
            className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
            {children}
          </main>
          <footer className="border-border text-muted-text border-t py-8 text-center text-xs">
            Quizzle · questions are AI-generated and checked against your notes — still,
            double-check before an exam.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
