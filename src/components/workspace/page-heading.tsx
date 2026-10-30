"use client";
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';

export function WorkspaceHeading({eyebrow,title,description,children}:{eyebrow?:string;title:string;description:string;children?:ReactNode}){
 const section=usePathname().split('/')[2]??'app';
 return <header className="page-heading workspace-section-header"><div className="workspace-section-identity"><span className="section-emblem" aria-hidden="true"><Icon name={section}/></span><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="muted description">{description}</p></div></div>{children&&<div className="workspace-section-actions">{children}</div>}</header>;
}
