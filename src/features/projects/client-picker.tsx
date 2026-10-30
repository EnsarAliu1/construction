"use client";
import {SearchSelect} from '@/components/workspace/search-select';
import type {ClientChoice} from './service';

export function ClientPicker({choices,selected,onSelect,optional=false,idPrefix='project'}:{choices:ClientChoice[];selected:ClientChoice|null;onSelect:(value:ClientChoice|null)=>void;optional?:boolean;idPrefix?:string}){
 return <div className="project-client-picker"><SearchSelect id={`${idPrefix}-client`} label={optional?'Filtri i klientit':'Klienti'} icon="clients" value={selected?{...selected,label:selected.name}:null} initialOptions={choices.map(row=>({...row,label:row.name}))} endpoint="/api/projects/clients?q=" onChange={row=>onSelect(row?{id:row.id,name:row.label,version:row.version}:null)} required={!optional} placeholder="Kërkoni klientin sipas emrit…" emptyLabel={optional?'Të gjithë klientët':'Zgjidhni klientin për këtë punishte'}/></div>;
}
