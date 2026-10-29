import Image from "next/image";
import type {CSSProperties} from "react";
import {AboutMotion} from "./about-motion";

function Building(){
 return <div className="about-building" data-about-reveal aria-hidden="true"><svg viewBox="0 0 360 440" fill="none" focusable="false">
  <path d="M30 409H330" stroke="#191919" strokeWidth="9"/>
  {Array.from({length:6},(_,index)=>{
   const i=5-index;
   const y=55+i*54;
   return <g className="about-floor" key={i} style={{'--floor-delay':`${(5-i)*90}ms`} as CSSProperties}><g className={i===0?'about-floor-crown':undefined}>
    <path d={`M80 ${y} 180 ${y-24} 280 ${y} 180 ${y+24}Z`} fill="#d8d5ce"/>
    <path d={`M80 ${y}v54l100 24V${y+24}Z`} fill="#faf9f5" stroke="#252525" strokeWidth="1.2"/>
    <path d={`m180 ${y+24} 100-24v54l-100 24Z`} fill="#aaa7a1" stroke="#252525" strokeWidth="1.2"/>
    {[96,123,150].map(x=><path key={x} d={`M${x} ${y+20+(x-96)*.24}v22l13 3v-22Z`} fill="#53534f"/>)}
   </g></g>;
  })}
 </svg></div>;
}

// Business figures explicitly confirmed by the owner on 29 October 2026.
const statistics=[{value:15,suffix:'+',label:'Vite përvojë'},{value:120,suffix:'+',label:'Projekte të përfunduara'},{value:98,suffix:'%',label:'Kënaqësi e klientëve'}];

export function AboutSection(){
 return <section id="rreth-nesh" className="site-about" aria-labelledby="about-title" tabIndex={-1}>
  <AboutMotion>
   <div className="about-container about-grid">
    <div className="about-left">
     <div data-about-reveal><p className="about-eyebrow"><span aria-hidden="true"/>RRETH NESH</p><h2 id="about-title">Themele të forta.<br/>Besim që zgjat.</h2></div>
     <div className="about-photo" data-about-reveal><Image src="/images/about-construction.jpg" width={1200} height={800} sizes="(max-width: 767px) 90vw, 52vw" alt="Ekip ndërtimi në një kantier me strukturë betoni dhe armaturë çeliku"/></div>
    </div>
    <div className="about-right"><Building/>
     <div className="about-copy" data-about-reveal><p className="about-lead">Prej më shumë se pesëmbëdhjetë vitesh, i japim formë hapësirave ku jetohet dhe punohet.</p><p>Te Fitimi Construction, besimi ndërtohet me përkushtim, saktësi dhe kujdes për çdo detaj. Besojmë në materiale të mira, punë të menduar dhe bashkëpunim të hapur — nga ideja e parë deri te përfundimi.</p></div>
    </div>
   </div>
   <section className="about-container about-statistics" aria-label="Fitimi Construction në shifra"><dl>{statistics.map(stat=><div className="about-stat" data-about-reveal key={stat.label}><dt>{stat.label}</dt><dd><span className="sr-only">{stat.value}{stat.suffix}</span><span aria-hidden="true"><span data-count-to={stat.value}>{stat.value}</span>{stat.suffix}</span></dd></div>)}</dl></section>
  </AboutMotion>
 </section>;
}
