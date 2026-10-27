import type {MetadataRoute} from "next";
import {indexingEnabled,siteOrigin} from "@/features/website/seo";
export default function robots():MetadataRoute.Robots{const origin=siteOrigin();return {rules:{userAgent:"*",...(indexingEnabled()?{allow:"/",disallow:["/app","/api","/login","/.private","/artifacts"]}:{disallow:"/"})},...(origin?{sitemap:origin+"/sitemap.xml"}:{})};}
