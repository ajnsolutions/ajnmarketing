"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white">
      <div className="relative mx-auto flex max-w-6xl items-center px-6 py-3 lg:px-8 lg:py-3.5">
        <Link
          href="/"
          className="relative z-10 shrink-0 transition-opacity duration-200 hover:opacity-90"
        >
          <Image
            src="/images/AJN_marketing_logo.png"
            alt="AJN Marketing"
            width={112}
            height={56}
            className="h-10 w-auto lg:h-14"
            priority
          />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "text-brand-600"
                    : "text-[#475569] hover:text-brand-600"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 ml-auto hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#475569] transition-colors duration-200 hover:text-[#0B1426]"
          >
            <UserIcon />
            Log In
          </Link>
          <CtaButton
            variant="navy"
            showArrow
            className="px-5 py-2.5 text-sm shadow-md"
          >
            See Your Free Demo
          </CtaButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="relative z-10 ml-auto inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#0B1426] shadow-sm transition-all duration-200 hover:border-slate-300 lg:hidden"
        >
          Menu
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`text-base font-medium transition-colors duration-200 ${
                    active
                      ? "text-brand-600"
                      : "text-[#475569] hover:text-brand-600"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 text-base font-medium text-[#475569]"
            >
              <UserIcon />
              Log In
            </Link>
            <CtaButton
              className="mt-2 w-full px-5 py-2.5 text-sm"
              variant="navy"
              showArrow
            >
              See Your Free Demo
            </CtaButton>
          </nav>
        </div>
      )}
    </header>
  );
}
