import type { NextConfig } from "next";
import {browserSecurityHeaders,contentSecurityPolicy} from "./src/server/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.FITIMI_TEST_BUILD === "wp15" ? ".next-wp15" : process.env.FITIMI_TEST_BUILD === "wp14" ? ".next-wp14" : process.env.FITIMI_TEST_BUILD === "wp13" ? ".next-wp13" : process.env.FITIMI_TEST_BUILD === "wp11" ? ".next-wp11" : process.env.FITIMI_TEST_BUILD === "wp10" ? ".next-wp10" : process.env.FITIMI_TEST_BUILD === "wp09" ? ".next-wp09" : ".next",
  serverExternalPackages: ["pdfkit", "exceljs", "jszip"],
  outputFileTracingExcludes: {"/*":["./artifacts/**/*","./.private/**/*","./.env*"]},
  outputFileTracingIncludes: {"/*":["./assets/security/*.txt"],"/api/payments":["./assets/fonts/*.ttf"],"/api/payments/*":["./assets/fonts/*.ttf"],"/api/reports/**":["./assets/fonts/*.ttf"],"/api/exports/**":["./assets/fonts/*.ttf"]},
  async headers(){return [
    {source:"/:path*",headers:browserSecurityHeaders},
    ...["/sq/:path*","/en/:path*","/"].map(source=>({source,headers:[{key:"Content-Security-Policy",value:contentSecurityPolicy(process.env.NODE_ENV==="production")}]})),
    {source:"/api/:path*",headers:[{key:"Cache-Control",value:"private, no-store, max-age=0"}]},
    ...["/sq/:path*","/en/:path*"].map(source=>({source,headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"}]})),
    ...["/app/:path*","/api/:path*","/login"].map(source=>({source,headers:[{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"}]}))
  ];},
  turbopack: { root: process.cwd() },
};

export default nextConfig;
