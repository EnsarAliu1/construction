import {kosovoDate} from "@/lib/presentation";
import Link from 'next/link';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';

export const readableDate=kosovoDate;
export function RecordAvatar({name,icon}:{name:string;icon?:string}){
 return <span className={`record-avatar${icon?' with-icon':''}`} aria-hidden="true">{icon?<Icon name={icon}/>:name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('sq')}</span>;
}
export function RecordsBar({total,label,description,options}:{total:number;label:string;description?:string;options?:{label:string;href:string;active:boolean}[]}){
 return <div className="records-bar"><div className="records-total"><span>{total}</span><div><h2>{label}</h2>{description&&<p>{description}</p>}</div></div>{options&&<nav className="records-tabs" aria-label={`Filtroni ${label.toLocaleLowerCase('sq')}`}>{options.map(option=><Link key={option.href} href={option.href} aria-current={option.active?'page':undefined} scroll={false}>{option.label}</Link>)}</nav>}</div>;
}
