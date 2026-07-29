import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Playwright's webServer serves the dev build over 127.0.0.1; without this,
  // Next dev mode blocks HMR/dev-asset requests from that origin as
  // cross-origin, which breaks client-side hydration in automated browser
  // tests (confirmed: without this, no client event handler attaches at all).
  //
  // "10.0.0.160" covers testing the dev server from another device on a
  // common home/office LAN (e.g. a phone, or a router-assigned address in
  // the 10.0.0.x range) — the exact same hydration-breaking behavior applies
  // there: any origin not in this list gets its HMR/dev-asset requests
  // blocked, which silently breaks every interactive control on the page
  // (forms fall back to native, non-JS submission). Dev-only — has no effect
  // on production or on any security boundary (SSRF/DNS-pinning/redirect
  // validation are unrelated, request-time checks in lib/business-discovery/
  // public/). If your LAN address differs, add it locally (don't rely on
  // this exact IP) — see docs/BUSINESS_DISCOVERY_SNAPSHOT_TROUBLESHOOTING.md.
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.0.160"],
};

export default nextConfig;
