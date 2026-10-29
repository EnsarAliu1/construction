import type {Metadata} from "next";
import Link from "next/link";
import "@/styles/globals.css";
export const metadata:Metadata={title:"Faqja nuk u gjet | Fitimi Construction",description:"Adresa e kërkuar nuk ekziston ose nuk është më e disponueshme.",robots:{index:false,follow:false}};
export default function GlobalNotFound(){return <html lang="sq"><body><main><h1>Faqja nuk u gjet</h1><p>Adresa e kërkuar nuk ekziston ose nuk është më e disponueshme.</p><Link href="/sq">Kthehu në kryefaqe</Link></main></body></html>;}
