import Image from "next/image";
import Link from "next/link";
import { navLinks, siteName, tagline } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#081426] text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 md:grid-cols-2">
        <div>
          <Image
            src="/images/AJN_marketing_logo_BLACK.png"
            alt={siteName}
            width={180}
            height={90}
            className="h-14 w-auto sm:h-16 md:h-[68px]"
          />
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            {tagline}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Pages
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-300 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-400">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
