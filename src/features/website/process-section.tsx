import type {CSSProperties} from 'react';
import {AboutMotion} from './about-motion';

const steps=[
 {title:'Konsultimi',description:'Dëgjojmë idenë tuaj dhe përcaktojmë nevojat, buxhetin dhe kushtet e projektit.'},
 {title:'Planifikimi dhe projektimi',description:'Qartësojmë zgjidhjen, vizatimet, dokumentacionin dhe planin e kostove.'},
 {title:'Ndërtimi',description:'I japim formë projektit me organizim të kujdesshëm, kontroll dhe komunikim të vazhdueshëm.'},
 {title:'Dorëzimi',description:'Përfundojmë kontrollin, dokumentacionin dhe dorëzimin e hapësirës së realizuar.'},
];

export function ProcessSection(){
 return <section id="procesi" className="process-section" aria-labelledby="process-heading" tabIndex={-1}>
  <AboutMotion><div className="process-blueprint" aria-hidden="true" data-about-reveal><svg viewBox="0 0 780 660" fill="none" focusable="false">
   <g className="process-house" stroke="currentColor" strokeWidth="1.5"><path pathLength="1" d="M20 190 400 60l380 130H20v350h760V190M190 540V318h174v222m116-240h145v115H480zM20 570h760M20 555v80m760-80v80M20 600h760"/><path className="process-hook" d="M400 60v90m-25-20a28 28 0 1 0 53 17" stroke="#cf7b3d"/></g>
  </svg></div>
  <div className="showcase-container process-content">
   <div data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>PROCESI YNË</p><h2 id="process-heading">Nga skica te çelësat.</h2></div>
   <ol className="process-timeline" data-about-reveal>{steps.map((step,index)=><li key={step.title} style={{'--step-delay':`${index*250}ms`} as CSSProperties}><span className="process-dot" aria-hidden="true"/><span className="process-step-number" aria-hidden="true">0{index+1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
  </div></AboutMotion>
 </section>;
}
