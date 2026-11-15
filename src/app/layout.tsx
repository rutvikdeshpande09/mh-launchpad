import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://mh-launchpad.vercel.app"),
  title: "MH Launchpad — local businesses, launched by local students",
  description:
    "Mountain House High School Tech Ambassadors turn a short multilingual interview into a free 3D website and digital business card for home-based local businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b-2 border-ink bg-background">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Image src="/logo-icon.png" alt="" width={36} height={36} priority className="size-9 rounded-lg border-2 border-ink" />
              MH Launchpad
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium sm:gap-3">
              <Link href="/#explore" className="rounded-lg px-3 py-1.5 hover:bg-ink hover:text-background">Explore</Link>
              <Link href="/creations" className="rounded-lg px-3 py-1.5 hover:bg-ink hover:text-background">My creations</Link>
              <Link href="/owner" className="rounded-lg px-3 py-1.5 hover:bg-ink hover:text-background">For businesses</Link>
              <Link href="/ambassador" className="rounded-lg px-3 py-1.5 hover:bg-ink hover:text-background">Ambassadors</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="bg-ink px-4 py-8 text-center text-sm text-background">
          <p>
            MH Launchpad is an independent project by Mountain House High School students.
          </p>
        </footer>
      </body>
    </html>
  );
}
