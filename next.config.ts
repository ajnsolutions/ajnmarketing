import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Playwright's webServer serves the dev build over 127.0.0.1; without this,
  // Next dev mode blocks HMR/dev-asset requests from that origin as
  // cross-origin, which breaks client-side hydration in automated browser
  // tests (confirmed: without this, no client event handler attaches at all).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
