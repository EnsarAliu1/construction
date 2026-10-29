"use client";

import Image from 'next/image';
import {useRef,useState} from 'react';
import {AboutMotion} from './about-motion';
import {showcaseProjects} from './showcase-data';

export function ProjectsShowcase(){
 const dialog=useRef<HTMLDialogElement>(null),[active,setActive]=useState<number|null>(null);
 const selected=active===null?null:showcaseProjects[active];
 function open(index:number){setActive(index);dialog.current?.showModal();}
 function move(direction:number){setActive(index=>index===null?null:(index+direction+showcaseProjects.length)%showcaseProjects.length);}
 return <section id="projektet" className="showcase-projects" aria-labelledby="showcase-projects-title" tabIndex={-1}>
  <AboutMotion><div className="showcase-container">
   <div data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>REFERENCA ARKITEKTURORE</p><h2 id="showcase-projects-title">Projekte të përzgjedhura.</h2><p className="showcase-note">Galeri ilustruese me fotografi referimi.</p></div>
   <div className="showcase-project-grid">{showcaseProjects.map((project,index)=><article className="showcase-project" data-about-reveal key={project.title}>
    <a href={project.src} className="showcase-project-open" onClick={event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open(index);}} aria-label={`Shiko fotografinë: ${project.title}`} aria-haspopup="dialog">
     <Image src={project.src} alt={project.alt} fill sizes="(max-width: 767px) 90vw, 44vw"/>
     <span className="showcase-project-tag">{project.category}</span><span className="showcase-project-arrow" aria-hidden="true">↗</span>
    </a>
    <div className="showcase-project-caption"><h3>{project.title}</h3><span>Referencë vizuale</span></div>
   </article>)}</div>
  </div></AboutMotion>
  <dialog className="showcase-dialog" ref={dialog} aria-labelledby="showcase-dialog-title" onClose={()=>setActive(null)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(1);}else if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}}}>
   <div className="showcase-dialog-header"><h3 id="showcase-dialog-title">{selected?.title??'Fotografia e projektit'}</h3><button type="button" onClick={()=>dialog.current?.close()} aria-label="Mbyll fotografinë" autoFocus>×</button></div>
   {selected&&<div className="showcase-dialog-image"><Image src={selected.src} alt={selected.alt} fill sizes="(max-width: 767px) 95vw, 1080px"/></div>}
   <div className="showcase-dialog-footer"><button type="button" onClick={()=>move(-1)} aria-label="Fotografia e mëparshme">←</button><p>Fotografi ilustruese <span aria-hidden="true">·</span> {active===null?0:active+1} / {showcaseProjects.length}</p><button type="button" onClick={()=>move(1)} aria-label="Fotografia tjetër">→</button></div>
  </dialog>
 </section>;
}
