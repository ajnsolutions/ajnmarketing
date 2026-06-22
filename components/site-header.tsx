"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeaderLogo } from "@/components/ajn-header-logo";
import { navLinks } from "@/lib/site-content";
import { CtaButton } from "./cta-button";

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 lg:gap-8 lg:py-5">
        <Link
          href="/"
          className="mr-2 shrink-0 transition-opacity duration-200 hover:opacity-90 lg:mr-10"
        >
          <HeaderLogo />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-9 lg:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "text-brand-600"
                    : "text-text-muted hover:text-brand-600"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="#"
            className="inline-flex items-center gap-2 text-sm font-medium text-text-muted transition-colors duration-200 hover:text-navy-900"
          >
            <UserIcon />
            Log In
          </Link>
          <CtaButton variant="navy" showArrow>
            See Your Free Demo
          </CtaButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-navy-900 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md lg:hidden"
        >
          Menu
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-navy-900 transition-colors duration-200 hover:text-brand-600"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="#"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 text-base font-medium text-navy-900"
            >
              <UserIcon />
              Log In
            </Link>
            <CtaButton className="mt-2 w-full" variant="navy" showArrow>
              See Your Free Demo
            </CtaButton>
          </nav>
        </div>
      )}
    </header>
  );
}
