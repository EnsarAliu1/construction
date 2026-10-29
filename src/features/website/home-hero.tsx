import Image from "next/image";
import Link from "next/link";
import {dictionaries,type Locale} from "@/i18n/dictionaries";

function Crane(){
 return <svg className="hero-crane" viewBox="0 0 500 720" fill="none" aria-hidden="true" focusable="false">
  <g stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
   <path d="M195 710V139h34v571M195 710l34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34"/>
   <path d="m229 710-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34-34-34 34-34M12 137l200-75 244 66M185 137l27-75 27 74M12 137h476l-28 20H12z"/>
   {Array.from({length:14},(_,i)=><path key={i} d={`m${12+i*32} 157 32-20`}/>)}
   <path d="M416 161v20"/>
   <path fill="currentColor" fillOpacity=".38" d="M20 160h54v44H20z" stroke="none"/>
   <path className="crane-rope" d="M416 202v264"/>
   <g className="crane-hook"><path d="m416 466-39 29m39-29 40 29"/><path d="M376 495h80v58h-80z" fill="currentColor" fillOpacity=".38"/><path d="M402 495v58m28-58v58M376 516h80" opacity=".45"/></g>
  </g><path fill="#c57649" d="M402 158h28v9h-28z"/>
 </svg>;
}

export function HomeHero({locale}:{locale:Locale}){
 // Owner-selected illustrative photograph, not a claim about a completed company project:
 // https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=2000&q=75
 const [first,...rest]=dictionaries[locale].pages.home.title.split(" ");
 return <section className="site-reference-hero" aria-labelledby="home-hero-title" data-motion-slot="building-assembly">
  <Image className="hero-photograph" src="/images/hero-architecture.jpg" alt="" fill preload sizes="100vw"/>
  <div className="hero-shade" aria-hidden="true"/><Crane/>
  <div className="hero-reference-content">
   <p className="hero-reference-eyebrow"><span aria-hidden="true"/>NGA IDEJA TE NDËRTIMI</p>
   <h1 id="home-hero-title"><span>{first}{" "}</span><span>{rest.join(" ")}</span></h1>
   <div className="hero-reference-bottom">
    <p className="hero-reference-tagline">Hapësira që frymëzojnë. Ndërtime që zgjasin.</p>
    <div className="hero-reference-actions"><Link className="hero-project-link" href={`/${locale}#projektet`}>Eksploro projektet<span aria-hidden="true">→</span></Link><Link className="hero-quote-link" href={`/${locale}#kontakti`}>Kërko ofertë</Link></div>
   </div>
  </div>
 </section>;
}
