"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navLinks, siteName } from "@/lib/site-content";
import { CtaButton } from "./cta-button";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          {siteName}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  active
                    ? "text-brand-700"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <CtaButton>See Your Free Demo</CtaButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 lg:hidden"
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
                className="text-base font-medium text-slate-700"
              >
                {link.label}
              </Link>
            ))}
            <CtaButton className="mt-2 w-full">See Your Free Demo</CtaButton>
          </nav>
        </div>
      )}
    </header>
  );
}
