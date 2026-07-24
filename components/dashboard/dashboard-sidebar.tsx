"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  advancedDashboardNavItems,
  primaryDashboardNavItems,
  type DashboardNavItem,
} from "./dashboard-nav";
import { ADVANCED_NAV_GROUPS } from "@/lib/customer-ux/navGroups";

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
  const primaryItems = primaryDashboardNavItems;
  const showAdvanced = !focusedNav;

  const byHref = new Map(advancedDashboardNavItems.map((item) => [item.href, item]));
  const groupedHrefs = new Set(ADVANCED_NAV_GROUPS.flatMap((group) => group.hrefs));
  const ungrouped = advancedDashboardNavItems.filter((item) => !groupedHrefs.has(item.href));

  const sidebarLogo = (
    <Link
      href="/dashboard"
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

  function renderLink(item: DashboardNavItem) {
    const active =
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`hom-focusable flex min-h-11 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
          active
            ? "bg-white text-[#081426] shadow-sm"
            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
        }`}
      >
        <span className={active ? "text-brand-600" : "text-slate-500"} aria-hidden>
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  }

  const nav = (
    <div className="flex flex-1 flex-col px-3 py-5">
      <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {focusedNav ? "Getting started" : "Main"}
      </p>
      <nav aria-label={focusedNav ? "Getting started" : "Main"} className="flex flex-col gap-1">
        {primaryItems.map(renderLink)}
      </nav>

      {showAdvanced && (
        <details className="group mt-6">
          <summary className="hom-focusable cursor-pointer list-none rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-h-11 items-center gap-2">
              More tools
              <span
                className="text-slate-600 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
                aria-hidden
              >
                ›
              </span>
            </span>
          </summary>
          <div className="hom-disclose-content mt-3 space-y-5">
            {ADVANCED_NAV_GROUPS.map((group) => {
              const items = group.hrefs
                .map((href) => byHref.get(href))
                .filter((item): item is DashboardNavItem => Boolean(item));
              if (items.length === 0) return null;
              return (
                <div key={group.id}>
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {group.label}
                  </p>
                  <p className="mt-1 px-3 text-[11px] leading-4 text-slate-600">{group.description}</p>
                  <nav
                    aria-label={group.label}
                    className="mt-2 flex flex-col gap-1"
                  >
                    {items.map(renderLink)}
                  </nav>
                </div>
              );
            })}
            {ungrouped.length > 0 && (
              <nav aria-label="Other tools" className="flex flex-col gap-1">
                {ungrouped.map(renderLink)}
              </nav>
            )}
          </div>
        </details>
      )}

      {focusedNav && (
        <p className="mt-6 px-3 text-xs leading-5 text-slate-500">
          More tools appear as your setup matures. Nothing important is locked away.
        </p>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#081426] lg:flex">
        <div className="border-b border-white/10 px-4 py-5">{sidebarLogo}</div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Your workspace
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">Head of Marketing</p>
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
          <aside className="relative flex h-full w-64 max-w-[85vw] flex-col overflow-y-auto bg-[#081426] shadow-2xl">
            <div className="border-b border-white/10 px-4 py-5">{sidebarLogo}</div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
