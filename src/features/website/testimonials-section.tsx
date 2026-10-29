import {AboutMotion} from './about-motion';

// Explicitly illustrative copy from the owner's reference, never real customer endorsements.
const examples=[
 {quote:'Kujdesi për çdo detaj e ktheu idenë tonë në një hapësirë me karakter. Bashkëpunimi ishte i qartë nga fillimi në fund.',kind:'Banim privat'},
 {quote:'Nga planifikimi deri te dorëzimi, çdo hap u shpjegua me qartësi. Vlerësuam komunikimin dhe organizimin e punës.',kind:'Hapësirë komerciale'},
 {quote:'Zgjidhje të menduara, qasje e kujdesshme dhe vëmendje ndaj realizimit. Një përvojë bashkëpunimi që krijon besim.',kind:'Projekt arkitektonik'},
];

export function TestimonialsSection(){
 return <section className="testimonials-section" aria-labelledby="testimonials-heading"><AboutMotion><div className="showcase-container">
  <div data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>PËRSHTYPJE · PËRMBAJTJE ILUSTRUESE</p><h2 id="testimonials-heading">Me fjalët e tyre.</h2></div>
  <div className="testimonials-grid">{examples.map((example,index)=><figure className="testimonial-card" data-about-reveal key={example.kind}>
   <span className="testimonial-mark" aria-hidden="true">“</span><blockquote><p>{example.quote}</p></blockquote>
   <figcaption><span>Klient ilustrues 0{index+1}</span><small>{example.kind} · Shembull ilustrues</small></figcaption>
  </figure>)}</div>
 </div></AboutMotion></section>;
}
