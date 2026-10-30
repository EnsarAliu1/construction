"use client";
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {WorkspaceIcon} from '@/components/layout/workspace-icon';
export function ActionDialog({title,children}:{title:string;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),label=useId();
 function close(){if(!dialog.current?.querySelector('[aria-busy="true"]'))dialog.current?.close();}
 useEffect(()=>{const current=dialog.current;return()=>{current?.close();};},[]);
 return <><button className="button client-secondary" type="button" onClick={()=>dialog.current?.showModal()}>{title}</button><dialog className="app-form-modal app-action-modal" ref={dialog} aria-labelledby={label} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="app-form-modal-content"><div className="app-modal-context"><span>Konfirmimi i veprimit</span><button type="button" className="workspace-icon-button" aria-label="Mbyllni konfirmimin" onClick={close}><WorkspaceIcon name="close"/></button></div><h2 id={label}>{title}</h2><div className="app-action-content">{children}</div></div></dialog></>;
}
