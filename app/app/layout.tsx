import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "AP CSA Prep",
  description: "Local practice app for AP Computer Science A.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/notebook", label: "Notebook" },
  { href: "/practice", label: "Practice Qs" },
  { href: "/spam", label: "FRQ Spam" },
  { href: "/exams", label: "Practice Exams" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-neutral-900">
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/65 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto max-w-6xl flex items-center gap-6 px-6 py-3">
            <Link
              href="/"
              className="font-semibold tracking-tight text-neutral-900"
            >
              CSA Prep
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-3 py-1.5 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
