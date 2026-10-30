"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {WorkspaceIcon} from '@/components/layout/workspace-icon';

export function PrivateTotals({children}:{children:ReactNode}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const hide=()=>setVisible(false);window.addEventListener('blur',hide);document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',hide);};},[]);
 return <section className="dashboard-private" aria-labelledby="private-totals-title"><div className="dashboard-private-heading"><div><span className="dashboard-overline">Vetëm kur ju nevojitet</span><h2 id="private-totals-title">Përmbledhja për gjithë kohën</h2><p>Totalet që nga fillimi, të fshehura për privatësinë tuaj.</p></div><button type="button" className="dashboard-privacy-button" aria-expanded={visible} aria-controls="dashboard-private-values" onClick={()=>setVisible(!visible)}><WorkspaceIcon name={visible?'eye-off':'eye'}/>{visible?'Fshihni totalet':'Shfaqni totalet'}</button></div><div id="dashboard-private-values">{visible?children:<div className="dashboard-private-placeholder"><WorkspaceIcon name="security"/><span>Shumat janë të fshehura. Hapini kur të jeni në një vend privat.</span></div>}</div></section>;
}
