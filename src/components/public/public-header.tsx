"use client";
import {useEffect,useRef,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';

export function PublicHeader({children}:{children:ReactNode}){
 const root=useRef<HTMLElement>(null),pathname=usePathname();
 useEffect(()=>{
  function update(){const value=String(window.scrollY>96);if(root.current&&root.current.dataset.scrolled!==value)root.current.dataset.scrolled=value;}
  update();window.addEventListener('scroll',update,{passive:true});
  return()=>window.removeEventListener('scroll',update);
 },[pathname]);
 return <header className="public-header" ref={root}>{children}</header>;
}
