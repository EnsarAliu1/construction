import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.FITIMI_TEST_BUILD === "wp09" ? ".next-wp09" : ".next",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingExcludes: {"/*":["./artifacts/**/*","./.private/**/*","./.env*"]},
  outputFileTracingIncludes: {"/api/payments":["./assets/fonts/*.ttf"],"/api/payments/*":["./assets/fonts/*.ttf"]},
  turbopack: { root: process.cwd() },
};

export default nextConfig;
