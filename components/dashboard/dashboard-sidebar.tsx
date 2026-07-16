"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavItems, focusedDashboardNavHrefs } from "./dashboard-nav";

export function DashboardSidebar({
  mobileOpen,
  onNavigate,
  focusedNav = false,
}: {
  mobileOpen: boolean;
  onNavigate?: () => void;
  focusedNav?: boolean;
}) {
  const pathname = usePathname();
  const items = focusedNav
    ? dashboardNavItems
        .filter((item) =>
          (focusedDashboardNavHrefs as readonly string[]).includes(item.href),
        )
        .map((item) =>
          item.href === "/dashboard/command-center"
            ? { ...item, label: "Home", href: "/dashboard" }
            : item,
        )
    : dashboardNavItems;

  const homeHref = focusedNav ? "/dashboard" : "/dashboard/command-center";

  const sidebarLogo = (
    <Link
      href={homeHref}
      onClick={onNavigate}
      className="block w-full transition-opacity hover:opacity-90"
    >
      <Image
        src="/images/AJN_marketing_logo_BLACK_transparent.png"
        alt="AJN Marketing"
        width={1024}
        height={264}
        priority
        sizes="(max-width: 1024px) 224px, 192px"
        className="h-auto max-h-14 w-full object-contain object-left"
      />
    </Link>
  );

  const nav = (
    <div className="flex flex-1 flex-col px-3 py-5">
      <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {focusedNav ? "Getting started" : "Main"}
      </p>
      <nav className="flex flex-col gap-2">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/dashboard/command-center"
                ? pathname === "/dashboard" ||
                  pathname.startsWith("/dashboard/command-center")
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
      {focusedNav && (
        <p className="mt-6 px-3 text-xs leading-5 text-slate-500">
          More options appear as your marketing setup matures. Nothing important is locked away.
        </p>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#081426] lg:flex">
        <div className="border-b border-white/10 px-4 py-5">
          {sidebarLogo}
        </div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Customer workspace
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">AJN Marketing workspace</p>
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
            <div className="border-b border-white/10 px-4 py-5">{sidebarLogo}</div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
