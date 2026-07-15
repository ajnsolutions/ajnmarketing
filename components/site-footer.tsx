import Image from "next/image";
import Link from "next/link";
import {
  footerExtraLinks,
  navLinks,
  siteName,
  tagline,
} from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#081426] text-[#CBD5E1]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.16) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.14),transparent_50%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-24">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-0">
          <div className="md:border-r md:border-white/10 md:pr-10 lg:pr-14">
            <div className="inline-flex rounded-xl bg-[#050d18] px-4 py-3 ring-1 ring-white/[0.06]">
              <Image
                src="/images/AJN_marketing_logo_BLACK.png"
                alt={siteName}
                width={160}
                height={80}
                className="h-12 w-auto sm:h-14 lg:h-[72px]"
              />
            </div>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#94A3B8]">
              {tagline}
            </p>
          </div>

          <div className="md:px-10 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Pages
            </p>
            <ul className="mt-5 space-y-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#CBD5E1] transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:pl-10 lg:pl-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              More
            </p>
            <ul className="mt-5 space-y-3">
              {footerExtraLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#CBD5E1] transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-6 text-[#64748B]">
              Privacy Policy and Terms of Service pages are coming soon.
            </p>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-[#64748B] lg:px-8">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
