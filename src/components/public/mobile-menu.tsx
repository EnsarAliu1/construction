"use client";
import Link from "next/link";
import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
import type {NavigationItem} from "@/types/navigation";
export function PublicMobileMenu({items,label,openLabel,closeLabel}:{items:NavigationItem[];label:string;openLabel:string;closeLabel:string}){
 const details=useRef<HTMLDetailsElement>(null),summary=useRef<HTMLElement>(null),pathname=usePathname();
 useEffect(()=>{if(details.current)details.current.open=false;},[pathname]);
 useEffect(()=>{function outside(e:PointerEvent){if(e.target instanceof Node&&!details.current?.contains(e.target)&&details.current)details.current.open=false;}document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[]);
 return <details className="site-mobile-menu" ref={details} onKeyDown={e=>{if(e.key==="Escape"&&details.current?.open){details.current.open=false;summary.current?.focus();}}} onBlur={e=>{if(e.relatedTarget instanceof Node&&!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false;}}><summary ref={summary} aria-controls="public-mobile-links"><span aria-hidden="true" className="menu-glyph">☰</span><span className="menu-closed-label">{openLabel}</span><span className="menu-open-label">{closeLabel}</span></summary><nav id="public-mobile-links" aria-label={label}>{items.map(item=><Link className="nav-item" aria-current={pathname===item.href?"page":undefined} href={item.href} key={item.href} onClick={()=>{if(details.current)details.current.open=false;}}>{item.label}</Link>)}</nav></details>;
}
