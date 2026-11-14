import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MH Launchpad — local businesses, launched by local students",
  description:
    "Mountain House High School Tech Ambassadors turn a short multilingual interview into a free 3D website and digital business card for home-based local businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">🚀</span>
              MH Launchpad
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium sm:gap-3">
              <Link href="/#explore" className="rounded-full px-3 py-1.5 hover:bg-black/5">Explore</Link>
              <Link href="/owner" className="rounded-full px-3 py-1.5 hover:bg-black/5">For businesses</Link>
              <Link href="/ambassador" className="rounded-full px-3 py-1.5 hover:bg-black/5">Ambassadors</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-8 text-center text-sm text-muted">
          <p>
            MH Launchpad is an independent project by Mountain House High School students.
          </p>
        </footer>
      </body>
    </html>
  );
}
