"use client";
import {useState,type ReactNode} from 'react';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';

export function FilterPanel({children,active=false,title='Filtra të tjerë'}:{children:ReactNode;active?:boolean;title?:string}){
 const [open,setOpen]=useState(active);
 return <details className="workspace-filter-panel" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary><Icon name="filter"/><span>{title}</span>{active&&<span className="filter-active-mark">Aktivë</span>}<Icon name="chevron"/></summary><div className="workspace-filter-content">{children}</div></details>;
}
