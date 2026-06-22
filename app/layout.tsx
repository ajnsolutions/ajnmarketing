import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteName, tagline } from "@/lib/site-content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const logoFont = Montserrat({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteName} | Local Google Visibility for Service Businesses`,
    template: `%s | ${siteName}`,
  },
  description: tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${logoFont.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
