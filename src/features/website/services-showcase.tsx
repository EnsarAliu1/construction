import Image from 'next/image';
import Link from 'next/link';
import {AboutMotion} from './about-motion';
import {showcaseServices} from './showcase-data';

function ServiceIcon({kind}:{kind:string}){
 const paths:Record<string,string>={home:'M3 12 12 4l9 8v10H3zm6 10v-8h6v8',building:'M3 22V3h11v19m0-13h7v13M7 7h3M7 12h3M7 17h3m10-4h1m-1 4h1',hammer:'m3 22 12-12m-5-4 5-5 7 7-5 5zm3-3 7 7',plan:'M2 12h20M4 22V8l8-6 8 6v14M2 22h20m-13 0v-7h6v7'};
 return <svg viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" focusable="false"><path d={paths[kind]}/></svg>;
}

export function ServicesShowcase(){
 return <section id="sherbimet" className="showcase-services" aria-labelledby="showcase-services-title" tabIndex={-1}>
  <AboutMotion><div className="showcase-container">
   <div data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>SHËRBIMET TONA</p><h2 id="showcase-services-title">Çdo përmasë. I njëjti standard.</h2></div>
   <div className="showcase-service-grid">{showcaseServices.map((service,index)=><article className="showcase-service" data-about-reveal key={service.image}>
    <Link href="/sq#projektet" aria-label={`${service.title} — shiko galerinë`}>
     <Image src={`/images/showcase/${service.image}.jpg`} alt="" fill sizes="(max-width: 600px) 90vw, (max-width: 1100px) 44vw, 22vw"/>
     <div className="showcase-service-shade" aria-hidden="true"/>
     <span className="showcase-service-icon"><ServiceIcon kind={service.icon}/></span><span className="showcase-service-number" aria-hidden="true">0{index+1}</span>
     <h3>{service.title}</h3><span className="showcase-service-arrow" aria-hidden="true">↗</span>
    </Link>
   </article>)}</div>
  </div></AboutMotion>
 </section>;
}
