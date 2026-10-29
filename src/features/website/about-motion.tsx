"use client";

import {useEffect,useRef,type ReactNode} from "react";

/** Progressive enhancement: the complete content and final figures exist without JS. */
export function AboutMotion({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const section=root.current;
  if(!section||!('IntersectionObserver' in window))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),frames=new Set<number>();
  const targets=section.querySelectorAll<HTMLElement>('[data-about-reveal]');
  function finish(){
   frames.forEach(cancelAnimationFrame);frames.clear();
   targets.forEach(element=>element.dataset.revealed='true');
   section?.querySelectorAll<HTMLElement>('[data-count-to]').forEach(element=>element.textContent=element.dataset.countTo!);
  }
  if(reduced.matches)return;
  section.dataset.motionReady='true';
  function count(element:HTMLElement){
   const value=Number(element.dataset.countTo),start=performance.now();
   element.textContent='0';
   function tick(now:number){
    const progress=Math.min((now-start)/1600,1);
    element.textContent=String(Math.round(value*(1-Math.pow(1-progress,3))));
    if(progress<1){const id=requestAnimationFrame(time=>{frames.delete(id);tick(time);});frames.add(id);}
   }
   const id=requestAnimationFrame(time=>{frames.delete(id);tick(time);});frames.add(id);
  }
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const element=entry.target as HTMLElement;element.dataset.revealed='true';observer.unobserve(element);
    element.querySelectorAll<HTMLElement>('[data-count-to]').forEach(count);
   });
  },{threshold:.15});
  targets.forEach(element=>observer.observe(element));
  function preferenceChanged(){if(reduced.matches){observer.disconnect();finish();}}
  reduced.addEventListener('change',preferenceChanged);
  return()=>{observer.disconnect();frames.forEach(cancelAnimationFrame);reduced.removeEventListener('change',preferenceChanged);delete section.dataset.motionReady;};
 },[]);
 return <div className="about-motion" ref={root}>{children}</div>;
}
