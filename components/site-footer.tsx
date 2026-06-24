import Image from "next/image";
import Link from "next/link";
import { navLinks, siteName, tagline } from "@/lib/site-content";

const companyLinks = [
  { href: "#", label: "About Us" },
  { href: "#", label: "Contact Us" },
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
] as const;

function SocialIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="#"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#CBD5E1] transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-gradient-to-b from-[#061120] via-[#081426] to-[#0B1426] text-[#CBD5E1]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.14) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.12),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10 lg:gap-14">
          <div>
            <div className="inline-flex rounded-2xl bg-[#061120] p-4 ring-1 ring-white/10">
              <Image
                src="/images/AJN_marketing_logo_BLACK.png"
                alt={siteName}
                width={176}
                height={88}
                className="h-14 w-auto sm:h-16 lg:h-20"
              />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#CBD5E1]">
              {tagline}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <SocialIcon label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M6.5 8.5h3v9h-3v-9Zm1.5-4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5ZM10 8.5h2.9v1.2h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6v4.76H16.3v-4.22c0-1.01-.02-2.31-1.41-2.31-1.41 0-1.63 1.1-1.63 2.24v4.29H10V8.5Z" />
                </svg>
              </SocialIcon>
              <SocialIcon label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M14 8.5V7.2c0-.66.44-1.2 1.24-1.2H17V3.9h-2.1C12.66 3.9 11 5.57 11 8v.5H9v3.1h2V21h3v-9.4h2.1l.4-3.1H14Z" />
                </svg>
              </SocialIcon>
              <SocialIcon label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
                  <circle cx="12" cy="12" r="3.2" />
                  <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
                </svg>
              </SocialIcon>
              <SocialIcon label="Email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5 12 13l8-5.5M5 18h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#E2E8F0]">
              Pages
            </p>
            <ul className="mt-4 space-y-2.5">
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

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#E2E8F0]">
              Company
            </p>
            <ul className="mt-4 space-y-2.5">
              {companyLinks.map((link) => (
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
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-400">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
