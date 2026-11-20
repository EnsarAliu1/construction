"use client";

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useRef,useState,type ReactNode} from 'react';
import {workspaceGroups,workspaceNavigation} from '@/features/workspace/sections';
import type {AuthenticatedUser} from '@/server/auth/security';
import {LogoutButton} from '@/components/auth/logout-button';
import {WorkspaceIcon as Icon} from './workspace-icon';

export function WorkspaceShell({children,user,initialTheme='light',initialCollapsed=false}:{children:ReactNode;user:AuthenticatedUser;initialTheme?:'light'|'dark';initialCollapsed?:boolean}){
 const pathname=usePathname(),[collapsed,setCollapsed]=useState(initialCollapsed),[theme,setTheme]=useState(initialTheme);
 const dialog=useRef<HTMLDialogElement>(null),menuButton=useRef<HTMLButtonElement>(null);
 const current=workspaceNavigation.find(item=>item.href==='/app'?pathname==='/app':pathname===item.href||pathname.startsWith(item.href+'/'));
 const initials=user.displayName.trim().split(/\s+/).slice(0,2).map(name=>name[0]).join('').toLocaleUpperCase('sq');
 function toggleTheme(){const next=theme==='light'?'dark':'light';setTheme(next);document.documentElement.dataset.workspaceTheme=next;document.cookie=`fitimi_theme=${next}; Path=/app; Max-Age=31536000; SameSite=Lax`;}
 function toggleCollapsed(){setCollapsed(!collapsed);document.cookie=`fitimi_sidebar=${collapsed?'expanded':'collapsed'}; Path=/app; Max-Age=31536000; SameSite=Lax`;}
 const closeMenu=()=>{dialog.current?.close();menuButton.current?.focus();};
 function brand(){return <Link href="/app" className="workspace-brand" aria-label="Construction — Paneli kryesor" onClick={()=>dialog.current?.close()}><Image className="workspace-brand-full" src="/logos/construction.png" alt="" width={512} height={581} sizes="42px" preload/><span className="workspace-brand-copy">Construction<small>HAPËSIRA E PUNËS</small></span><Image className="workspace-brand-symbol" src="/logos/construction.png" alt="" width={42} height={42}/></Link>;}
 function links(mobile=false){return <nav aria-label={mobile?'Navigimi në telefon':'Navigimi kryesor'} className="workspace-navigation">{workspaceGroups.map(group=><div className="workspace-nav-group" key={group.label}><p className="workspace-group-label">{group.label}</p>{group.items.map(item=>{const active=item.href==='/app'?pathname===item.href:pathname===item.href||pathname.startsWith(item.href+'/');return <Link key={item.href} href={item.href} className={`workspace-nav-link${active?' active':''}`} aria-current={active?'page':undefined} title={!mobile&&collapsed?item.label:undefined} onClick={()=>dialog.current?.close()}><Icon name={item.href.split('/')[2]??'app'}/><span>{item.label}</span></Link>;})}</div>)}</nav>;}
 return <div className={`workspace-layout workspace-refresh${collapsed?' is-collapsed':''}`}>
  <a href="#main-content" className="skip-link">Kalo te përmbajtja</a>
  <aside className="sidebar workspace-sidebar">{brand()}{links()}<div className="workspace-sidebar-bottom"><Link href="/sq" className="workspace-public-link" title={collapsed?'Faqja publike':undefined}><Icon name="external"/><span>Faqja publike</span></Link><button type="button" className="workspace-collapse" onClick={toggleCollapsed} aria-label={collapsed?'Zgjero menynë':'Palos menynë'} aria-expanded={!collapsed}><Icon name={collapsed?'unfold':'fold'}/><span>Palos menynë</span></button></div></aside>
  <div className="workspace-body"><header className="workspace-topbar">
   <button ref={menuButton} type="button" className="workspace-icon-button workspace-mobile-trigger" aria-label="Hap menynë" aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}><Icon name="menu"/></button>
   <div className="workspace-header-heading"><p className="workspace-header-overline">Construction</p><nav className="workspace-breadcrumb" aria-label="Vendndodhja"><Link href="/app">Construction</Link><span aria-hidden="true">/</span><span aria-current="page">{current?.label??'Hapësira e punës'}</span></nav></div>
   <div className="workspace-header-actions"><MenuSearch key={pathname}/><button type="button" className="workspace-icon-button workspace-theme-toggle" onClick={toggleTheme} aria-label={theme==='light'?'Aktivizo pamjen e errët':'Aktivizo pamjen e çelët'}><Icon name={theme==='light'?'moon':'sun'}/></button>
    <details key={`profile:${pathname}`} className="workspace-profile" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary><span className="workspace-avatar" aria-hidden="true">{initials}</span><span className="workspace-profile-copy"><strong>{user.displayName}</strong><small>Hapësira e punës</small></span><Icon name="chevron"/><span className="sr-only">Menyja e llogarisë</span></summary><div className="workspace-profile-menu"><p>{user.displayName}</p><Link href="/app/security">Cilësimet & Siguria</Link><Link href="/app/accounts">Llogaritë</Link><LogoutButton/></div></details>
   </div>
  </header><main id="main-content" className="workspace-content" tabIndex={-1}>{children}</main></div>
  <dialog ref={dialog} className="workspace-mobile-dialog" aria-label="Menyja e administratës" onClick={event=>{if(event.target===event.currentTarget)closeMenu();}}><div className="workspace-mobile-panel"><div className="workspace-mobile-brand">{brand()}<button type="button" className="workspace-icon-button" aria-label="Mbyll menynë" onClick={closeMenu}><Icon name="close"/></button></div>{links(true)}<Link className="workspace-public-link" href="/sq"><Icon name="external"/>Faqja publike</Link></div></dialog>
 </div>;
}

function MenuSearch(){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false);
 const matches=workspaceNavigation.filter(item=>item.label.toLocaleLowerCase('sq').includes(query.trim().toLocaleLowerCase('sq')));
 return <div className="workspace-menu-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape')setOpen(false);}}><Icon name="search"/><label htmlFor="workspace-search" className="sr-only">Kërkoni një seksion të menusë</label><input id="workspace-search" type="search" placeholder="Kërko në menu…" value={query} maxLength={80} autoComplete="off" onChange={event=>{setQuery(event.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} aria-controls={open?'workspace-search-results':undefined}/>{open&&<div className="workspace-search-results" id="workspace-search-results"><p>Seksionet e administratës</p>{matches.length?matches.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)}><Icon name={item.href.split('/')[2]??'app'}/>{item.label}</Link>):<p role="status">Nuk u gjet asnjë seksion.</p>}</div>}</div>;
}
