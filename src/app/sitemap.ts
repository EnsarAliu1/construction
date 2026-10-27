import type {MetadataRoute} from "next";
import {publicSitemap} from "@/features/website/seo";
export default function sitemap():MetadataRoute.Sitemap{return publicSitemap();}
