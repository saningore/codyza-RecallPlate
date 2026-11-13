import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
import Link from "next/link";
import { NOT_GOVERNMENT, NO_GUARANTEE } from "@/lib/copy";
import "./globals.css";

const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: { default: "RecallPlate", template: "%s · RecallPlate" },
  description: "Search published U.S. food recall records from FDA and USDA.",
  applicationName: "RecallPlate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="no-print bg-amber px-4 py-2 text-center text-sm">{NOT_GOVERNMENT}</div>
        <header className="no-print border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pine text-card" aria-hidden="true">
                <svg viewBox="0 0 32 32" className="h-7 w-7">
                  <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="16" r="3" fill="currentColor" />
                </svg>
              </span>
              <span>
                <span className="block font-serif text-2xl font-semibold leading-none tracking-tight">RecallPlate</span>
                <span className="text-sm text-ink/70">Real Food Recall Finder</span>
              </span>
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm font-bold" aria-label="Primary">
              <Link className="rounded-full px-3 py-2 hover:bg-moss" href="/">Search</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-moss" href="/saved">Saved</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-moss" href="/sources">Sources</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-moss" href="/about">About</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-line px-4 py-8 text-center text-sm">
          <p className="font-bold">
            Powered by <a className="text-sea underline underline-offset-2" href="https://codyza.com" target="_blank" rel="noopener noreferrer">Codyza</a>
          </p>
          <p className="mx-auto mt-2 max-w-3xl text-ink/80">{NO_GUARANTEE}</p>
        </footer>
      </body>
    </html>
  );
}
