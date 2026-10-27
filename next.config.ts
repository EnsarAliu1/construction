import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.FITIMI_TEST_BUILD === "wp11" ? ".next-wp11" : process.env.FITIMI_TEST_BUILD === "wp10" ? ".next-wp10" : process.env.FITIMI_TEST_BUILD === "wp09" ? ".next-wp09" : ".next",
  serverExternalPackages: ["pdfkit", "exceljs", "jszip"],
  outputFileTracingExcludes: {"/*":["./artifacts/**/*","./.private/**/*","./.env*"]},
  outputFileTracingIncludes: {"/api/payments":["./assets/fonts/*.ttf"],"/api/payments/*":["./assets/fonts/*.ttf"],"/api/reports/**":["./assets/fonts/*.ttf"],"/api/exports/**":["./assets/fonts/*.ttf"]},
  async headers(){return [
    ...["/sq/:path*","/en/:path*"].map(source=>({source,headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"}]})),
    ...["/app/:path*","/api/:path*","/login"].map(source=>({source,headers:[{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"}]}))
  ];},
  turbopack: { root: process.cwd() },
};

export default nextConfig;
