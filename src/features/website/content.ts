import {locales,type Locale} from "@/i18n/dictionaries";
export type Localized=Record<Locale,string>;
type Approval={publication:"draft"|"approved";approvalReference:string};
export type PublicService=Approval&{id:string;title:Localized;description:Localized;details:Localized[]};
export type ApprovedPhoto={src:string;width:number;height:number;alt:Localized;rightsApproval:string};
export type PublicProject=Approval&{id:string;title:Localized;description:Localized;publicationConsent:string;photos:ApprovedPhoto[]};
export type PublicContact=Approval&{kind:"email"|"phone"|"address";value:string};
// Curated public publishing boundary. Never query management-system projects here.
export const serviceContent:readonly PublicService[]=[];
export const projectContent:readonly PublicProject[]=[];
export const contactContent:readonly PublicContact[]=[];
export const missingContent=["approved-legal-identity","official-brand-assets","confirmed-service-catalogue","public-project-copy-and-consent","photography-and-image-rights","verified-contact-details","contact-delivery-and-privacy-policy","public-domain-and-indexing-approval"] as const;
const text=(v:Localized)=>locales.every(l=>typeof v[l]==="string"&&v[l].trim().length>0);
function approval(entry:Approval){if(!entry.approvalReference.trim()||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((entry as {id?:string}).id??"contact"))throw new Error("Public content needs a valid identity and approval reference.");}
export function publishedServices(entries:readonly PublicService[]=serviceContent){return entries.filter(e=>e.publication==="approved").map(e=>{approval(e);if(!text(e.title)||!text(e.description)||e.details.some(d=>!text(d)))throw new Error("Both service translations are required.");return e;});}
export function publishedProjects(entries:readonly PublicProject[]=projectContent){return entries.filter(e=>e.publication==="approved").map(e=>{approval(e);if(!text(e.title)||!text(e.description)||!e.publicationConsent.trim()||!e.photos.length)throw new Error("Public project needs bilingual copy, consent and approved photography.");for(const p of e.photos)if(!/^\/images\/approved\/[a-zA-Z0-9/_-]+\.(?:avif|webp|png|jpe?g)$/.test(p.src)||!p.rightsApproval.trim()||!text(p.alt)||![p.width,p.height].every(v=>Number.isInteger(v)&&v>0&&v<=8192))throw new Error("Invalid approved project media.");return e;});}
export function publishedContacts(entries:readonly PublicContact[]=contactContent){return entries.filter(e=>e.publication==="approved").map(e=>{approval(e);if(!e.value.trim()||/[\u0000-\u001f\u007f<>]/u.test(e.value)||(e.kind==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.value))||(e.kind==="phone"&&!/^\+[1-9]\d{6,14}$/.test(e.value)))throw new Error("Invalid verified contact.");return e;});}
