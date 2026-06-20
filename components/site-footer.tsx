import Link from "next/link";
import { navLinks, siteName, tagline } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <p className="text-lg font-bold text-white">{siteName}</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-400">
            {tagline}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
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

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
