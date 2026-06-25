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
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
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
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
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
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#081426] lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/dashboard" className="inline-flex transition-opacity hover:opacity-90">
            <Image
              src="/images/AJN_marketing_logo_BLACK.png"
              alt="AJN Marketing"
              width={128}
              height={64}
              className="h-10 w-auto"
            />
          </Link>
        </div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-5 py-4">
          <p className="text-xs text-slate-500">Customer workspace</p>
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
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[#081426] shadow-2xl">
            <div className="border-b border-white/10 px-5 py-5">
              <Image
                src="/images/AJN_marketing_logo_BLACK.png"
                alt="AJN Marketing"
                width={128}
                height={64}
                className="h-10 w-auto"
              />
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
