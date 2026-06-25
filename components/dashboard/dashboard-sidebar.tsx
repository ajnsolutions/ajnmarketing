"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavItems } from "./dashboard-nav";

export function DashboardSidebar({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const nav = (
    <div className="flex flex-1 flex-col px-3 py-5">
      <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Main
      </p>
      <nav className="flex flex-col gap-2">
        {dashboardNavItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-white text-[#081426] shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              }`}
            >
              <span className={active ? "text-brand-600" : "text-slate-500"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#081426] lg:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/dashboard" className="inline-flex transition-opacity hover:opacity-90">
            <Image
              src="/images/AJN_marketing_logo_BLACK.png"
              alt="AJN Marketing"
              width={112}
              height={56}
              className="h-9 w-auto"
            />
          </Link>
        </div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Customer workspace
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">Demo preview mode</p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[#081426]/60 backdrop-blur-sm"
            onClick={onNavigate}
          />
          <aside className="relative flex h-full w-64 max-w-[85vw] flex-col bg-[#081426] shadow-2xl">
            <div className="border-b border-white/10 px-4 py-5">
              <Image
                src="/images/AJN_marketing_logo_BLACK.png"
                alt="AJN Marketing"
                width={112}
                height={56}
                className="h-9 w-auto"
              />
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
