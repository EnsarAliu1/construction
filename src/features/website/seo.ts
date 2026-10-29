import type {Metadata} from "next";
import {dictionaries,locales,publicPath,type Locale,type PublicPage} from "@/i18n/dictionaries";
export function siteOrigin(value=process.env.PUBLIC_SITE_URL):string|null{
 if(!value?.trim())return null;
 try{const url=new URL(value.trim());if(url.username||url.password||url.search||url.hash||url.pathname!=="/"||!(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))throw new Error();return url.origin;}catch{throw new Error("Configure PUBLIC_SITE_URL as one safe HTTPS origin, without credentials or a path.");}
}
export const indexingEnabled=()=>Boolean(siteOrigin()&&process.env.PUBLIC_SITE_INDEXING==="1");
export function publicMetadata(locale:Locale,page:PublicPage):Metadata{
 const origin=siteOrigin(),copy=dictionaries[locale],path=publicPath(locale,page),title=`${copy.nav[page]} | Fitimi Construction`;
 return {title:{absolute:title},description:copy.pages[page].description,robots:{index:indexingEnabled(),follow:indexingEnabled()},alternates:origin?{canonical:origin+path,languages:{sq:origin+publicPath("sq",page),"x-default":origin+publicPath("sq",page)}}:undefined,openGraph:{title,description:copy.pages[page].description,type:"website",siteName:"Fitimi Construction",locale:"sq_AL",...(origin?{url:origin+path}:{})},twitter:{card:"summary",title,description:copy.pages[page].description}};
}
export function publicSitemap(){const origin=siteOrigin();if(!origin)return [];return locales.flatMap(locale=>(["home"] as const).map(page=>({url:origin+publicPath(locale,page),alternates:{languages:{sq:origin+publicPath("sq",page),"x-default":origin+publicPath("sq",page)}}})));}
