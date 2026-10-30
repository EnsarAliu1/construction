import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {Card,PageHeading} from '@/components/ui';
import {WorkspaceIcon} from '@/components/layout/workspace-icon';
import {requirePageUser} from '@/server/auth/web';
import {AuthenticationRequired,sessionCookieSettings} from '@/server/auth/security';
import {withAuthConnection} from '@/server/auth/store';
import {listActivity} from '@/features/workspace/history-service';
import {historyTypes,parseHistoryQuery} from '@/features/workspace/history-query';
import {actionLabel,fieldLabel,fieldValue} from '@/i18n/format';
import type {HistorySnapshot} from '@/server/db/history-snapshot';

export const metadata={title:'Historiku i veprimeve'};
function Snapshot({label,value}:{label:string;value:HistorySnapshot|null}){return <section><h3>{label}</h3>{value?<dl className="client-snapshot">{Object.entries(value).map(([key,entry])=><div key={key}><dt>{fieldLabel(key)}</dt><dd>{fieldValue(key,entry)}</dd></div>)}</dl>:<p className="muted">Nuk ka të dhëna.</p>}</section>;}
export default async function HistoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requirePageUser('/app/history');const params=await searchParams;let query;
 try{query=parseHistoryQuery(params);}catch{return <Card><h1>Historiku</h1><p role="alert">Filtrat e historikut nuk janë të vlefshëm.</p><Link className="text-link" href="/app/history">Pastroni filtrat</Link></Card>;}
 const token=(await cookies()).get(sessionCookieSettings().name)?.value;
 let data;
 try{data=await withAuthConnection(connection=>listActivity(connection,token,params));}catch(error){if(error instanceof AuthenticationRequired)redirect('/administrata?returnTo=%2Fapp%2Fhistory');return <><PageHeading title="Historiku" description="Veprimet e regjistruara në sistem."/><Card><p role="alert">Historiku është përkohësisht i padisponueshëm. Provoni përsëri.</p></Card></>;}
 const pages=Math.max(1,Math.ceil(data.total/40));
 const href=(page:number)=>'/app/history?'+new URLSearchParams({type:query.type,entityId:query.entityId,page:String(page)});
 return <><PageHeading eyebrow="Gjurmët e aktivitetit" title="Historiku" description="Veprimet e regjistruara në sistem: kush i kreu, kur dhe çfarë ndryshoi. Historiku ruhet automatikisht dhe nuk mund të ndryshohet nga kjo faqe."/>
 <Card><form action="/app/history" method="get" className="activity-filters"><div className="form-field"><label htmlFor="history-type">Seksioni</label><select id="history-type" name="type" className="input" defaultValue={query.type}><option value="all">Të gjitha seksionet</option>{Object.entries(historyTypes).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></div><div className="form-field activity-id"><label htmlFor="history-id">Identifikuesi i regjistrimit (opsional)</label><input id="history-id" name="entityId" className="input" maxLength={36} defaultValue={query.entityId} placeholder="Identifikuesi i plotë"/></div><button className="button" type="submit">Shfaqni veprimet</button><Link className="text-link" href="/app/history">Pastroni filtrat</Link></form></Card>
 <Card className="activity-events"><div className="section-title"><h2>{data.total} veprime të regjistruara</h2><span className="muted">Koha në UTC</span></div>{data.rows.length?data.rows.map(event=><details className="activity-event" key={event.id}><summary><span className="activity-dot"><WorkspaceIcon name="history"/></span><span className="activity-event-copy"><strong>{actionLabel(event.action)}</strong><small>{event.actor} · {event.recordedAt} UTC</small><small>{historyTypes[event.type]??'Veprim i sistemit'} · {event.entityId}</small></span><WorkspaceIcon name="chevron"/></summary><div className="client-history-snapshots"><Snapshot label="Para ndryshimit" value={event.before}/><Snapshot label="Pas ndryshimit" value={event.after}/></div></details>):<p className="muted">Nuk ka veprime për këta filtra.</p>}</Card>
 <nav className="client-pagination" aria-label="Faqet e historikut"><div>{query.page>1&&<Link className="button client-secondary" href={href(query.page-1)}>Para</Link>}</div><p>Faqja {query.page} nga {pages}</p><div>{query.page<pages&&<Link className="button client-secondary" href={href(query.page+1)}>Pas</Link>}</div></nav></>;
}
