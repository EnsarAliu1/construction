import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.FITIMI_TEST_BUILD === "wp10" ? ".next-wp10" : process.env.FITIMI_TEST_BUILD === "wp09" ? ".next-wp09" : ".next",
  serverExternalPackages: ["pdfkit", "exceljs", "jszip"],
  outputFileTracingExcludes: {"/*":["./artifacts/**/*","./.private/**/*","./.env*"]},
  outputFileTracingIncludes: {"/api/payments":["./assets/fonts/*.ttf"],"/api/payments/*":["./assets/fonts/*.ttf"],"/api/reports/**":["./assets/fonts/*.ttf"],"/api/exports/**":["./assets/fonts/*.ttf"]},
  turbopack: { root: process.cwd() },
};

export default nextConfig;
