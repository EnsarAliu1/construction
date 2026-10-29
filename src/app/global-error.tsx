"use client";
import Link from "next/link";

export default function GlobalError({reset}:{error:Error & {digest?:string};reset:()=>void}){
 return <html lang="sq"><body><main><h1>Ndodhi një gabim</h1><p>Faqja nuk mund të ngarkohet për momentin. Provoni përsëri.</p><button onClick={reset}>Provoni përsëri</button><Link href="/sq">Kthehu në kryefaqe</Link></main></body></html>;
}
