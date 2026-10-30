"use client";
import {useFilterNavigation} from '@/components/workspace/use-filter-navigation';
import {FilterPanel} from '@/components/workspace/filter-panel';
import {PaymentMethod} from '@/components/workspace/payment-method';
import {AllocationEditor} from './allocation-editor';
import Link from "next/link";
import {useRouter} from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, Card, FormField, Input } from "@/components/ui";
import { ExpensePicker } from "@/features/expenses/forms";
import { cents, decimal, inputMoney } from "@/features/projects/money";
import type { ExpenseChoice } from "@/features/expenses/service";
import type { PaymentDetails, PaymentProject } from "./service";
import type { parsePaymentQuery } from "./validation";
import {readRecoveryKey,retainRecoveryKey} from "./recovery-key";

export function PaymentForm({detail,initialProject,actorId,initialDate}:{detail?:PaymentDetails;initialProject?:PaymentProject;actorId:string;initialDate?:string}){
  const [choice,setChoice]=useState<ExpenseChoice|null>(initialProject?{id:initialProject.project.id,version:initialProject.project.version,label:initialProject.project.name}:null);
  const [project,setProject]=useState(initialProject??null),[amount,setAmount]=useState(detail?.payment.amount??""),[date,setDate]=useState(detail?.payment.transactionDate??initialDate??""),[method,setMethod]=useState(detail?.payment.method??"cash");
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(detail?.allocations.filter(row=>!row.allocation.deletedAt).map(row=>[row.allocation.phaseId,row.allocation.amount])??[]));
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(false),[conflict,setConflict]=useState(false),[unauthorized,setUnauthorized]=useState(false);
  const router=useRouter(),pendingKey=`fitimi.payment.pending.${actorId}`;
  const flight=useRef(false),form=useRef<HTMLFormElement>(null),alert=useRef<HTMLDivElement>(null);
  const pendingRequest=useRef<{idempotencyKey:string;payment:unknown}|null>(null);
  const clearPending=()=>{sessionStorage.removeItem(pendingKey);pendingRequest.current=null;};
  const selected=project?.project.id===choice?.id;
  let total="0.00",difference="Nuk është llogaritur";
  try{total=decimal(Object.values(values).filter(value=>value.trim()).reduce((sum,value)=>sum+cents(inputMoney(value)),BigInt(0)));difference=decimal(cents(inputMoney(amount))-cents(total));}catch{difference="Shkruani vlera të vlefshme në EUR";}
  const projectLoadId=useRef(0);
  async function load(next:ExpenseChoice|null=choice){
    const generation=++projectLoadId.current;
    if(!next){setProject(null);setValues({});setLoading(false);return;}
    setLoading(true);setMessage("");setProject(null);setValues({});
    try{const response=await fetch(`/api/payments/projects/${next.id}`,{cache:"no-store"}),body=await response.json();if(generation!==projectLoadId.current)return;if(!response.ok){setMessage(body.message);return;}setProject(body);}
    catch{if(generation===projectLoadId.current)setMessage("Fazat nuk mund të ngarkohen. Provoni përsëri.");}
    finally{if(generation===projectLoadId.current)setLoading(false);}
  }
  function chooseProject(next:ExpenseChoice|null){setChoice(next);void load(next);}

  async function recover(){
    if(flight.current)return;flight.current=true;setBusy(true);setMessage("");let saved=false;
    try{const pending=readRecoveryKey(sessionStorage,pendingKey);if(!pending){setMessage("Nuk ka konfirmim në pritje në këtë skedë.");return;}
      const status=await fetch(`/api/payments/operations/${encodeURIComponent(pending.idempotencyKey)}`,{cache:"no-store"}),operation=await status.json();
      if(status.ok&&operation.status==="completed"){if(!operation.documentAvailable){setMessage("Pagesa u regjistrua, por dokumenti është i padisponueshëm. Mos krijoni pagesë tjetër; kontaktoni operatorin.");return;}clearPending();saved=true;router.push(`/app/payments/${operation.paymentId}`);router.refresh();return;}
      if(status.status!==404){setMessage(operation.message??"Gjendja e veprimit është e padisponueshme; ruajeni çelësin fillestar të konfirmimit.");return;}
      const retry=pendingRequest.current;
      if(!retry||retry.idempotencyKey!==pending.idempotencyKey){setMessage("Nuk u gjet pagesë e përfunduar me këtë çelës. Rishkruani të dhënat fillestare dhe konfirmoni me çelësin e ruajtur të rikuperimit. Nëse gjendja është e padisponueshme, mos dërgoni pagesë të re.");return;}
      const response=await fetch("/api/payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(retry)}),body=await response.json();if(!response.ok){if([400,409].includes(response.status)&&!["IDEMPOTENCY_CONFLICT","OPERATION_PENDING"].includes(body.code))clearPending();setMessage(body.message??"Përpjekja dështoi; çelësi fillestar i konfirmimit është ruajtur.");return;}
      clearPending();saved=true;router.push(`/app/payments/${body.paymentId}`);router.refresh();
    }catch{setMessage("Rikuperimi dështoi. Konfirmimi fillestar mbetet në pritje; provoni rikuperimin para se të krijoni pagesë tjetër.");}finally{if(!saved){flight.current=false;setBusy(false);}}
  }
  async function check(e:FormEvent){
    e.preventDefault();if(flight.current||!project||!selected)return;
    const finalize=(e.nativeEvent as SubmitEvent).submitter?.getAttribute("value")==="confirm";
    flight.current=true;setBusy(true);setMessage("");setErrors({});setConflict(false);setUnauthorized(false);let saved=false;
    const payment={projectId:project.project.id,projectVersion:project.project.version,contractId:project.contract.id,contractVersion:project.contract.version,amount,transactionDate:date,method,allocations:project.phases.filter(phase=>values[phase.id]?.trim()).map(phase=>({phaseId:phase.id,phaseVersion:phase.version,amount:values[phase.id]}))};
    try{
      let payload:object=detail?{version:detail.payment.version,confirmation:confirmed?"correct":"",payment}:payment;
      if(finalize&&!detail){
        const retained=readRecoveryKey(sessionStorage,pendingKey),prior=pendingRequest.current;
        if(prior&&JSON.stringify(prior.payment)!==JSON.stringify(payment)){setMessage("Një konfirmim i mëparshëm mund të jetë ende në pritje. Rikuperojeni para se të dërgoni vlera të tjera.");return;}
        if(retained&&!prior){const status=await fetch(`/api/payments/operations/${encodeURIComponent(retained.idempotencyKey)}`,{cache:"no-store"}),operation=await status.json();
          if(status.ok&&operation.status==="completed"){if(!operation.documentAvailable){setMessage("Pagesa u regjistrua, por dokumenti është i padisponueshëm. Mos krijoni pagesë tjetër; kontaktoni operatorin.");return;}clearPending();saved=true;router.push(`/app/payments/${operation.paymentId}`);router.refresh();return;}
          if(status.status!==404){setMessage("Gjendja e konfirmimit fillestar është e padisponueshme. Rikuperojeni para se të dërgoni pagesë.");return;}}
        const pending={idempotencyKey:retained?.idempotencyKey??crypto.randomUUID(),payment};retainRecoveryKey(sessionStorage,pendingKey,pending.idempotencyKey);pendingRequest.current=pending;payload=pending;
      }
      const url=finalize?(detail?`/api/payments/${detail.payment.id}`:"/api/payments"):(detail?`/api/payments/${detail.payment.id}/preview`:"/api/payments/preview");
      const response=await fetch(url,{method:finalize&&detail?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),body=await response.json();
      setErrors(body.fields??{});setConflict(body.code==="CONFLICT"||body.code==="CAPACITY");setUnauthorized(response.status===401);
      if(!response.ok){if(finalize&&!detail&&[400,409].includes(response.status)&&!["IDEMPOTENCY_CONFLICT","OPERATION_PENDING"].includes(body.code))clearPending();setMessage(body.message??"Ruajtja dështoi. Kontrolloni veprimin fillestar para ridërgimit.");return;}
      if(finalize){if(!detail)clearPending();saved=true;router.push(`/app/payments/${detail?.payment.id??body.paymentId}`);router.refresh();return;}
      setMessage(body.message??"Kontrolli i ndarjes së pagesës përfundoi.");
    }catch{setMessage("Kërkesa nuk mund të përfundohet. Për pagesë të re përdorni rikuperimin e konfirmimit të fundit; mos krijoni çelës tjetër konfirmimi.");}finally{if(!saved){flight.current=false;setBusy(false);requestAnimationFrame(()=>((form.current?.querySelector('[aria-invalid="true"]')as HTMLElement|null)??alert.current)?.focus());}}
  }
  const path=detail?`/app/payments/${detail.payment.id}/edit`:"/app/payments/new";
  return <Card><p className="client-alert" role="note">Regjistroni vetëm para të pranuara. Konfirmimi ruan pagesën dhe dëftesën JO-FISKALE të pandryshueshme; kontrolli i ndarjes nuk ruan të dhëna dhe nuk rezervon kapacitet.</p><form ref={form} onSubmit={check} aria-busy={busy||loading}>{message&&<div ref={alert} tabIndex={-1} role="alert" className="client-alert"><p>{message}</p>{conflict&&<a className="text-link" href={path}>Ringarkoni pagesën dhe kapacitetet aktuale</a>}{unauthorized&&<Link className="text-link" href={`/administrata?returnTo=${encodeURIComponent(path)}`}>Hyni përsëri</Link>}</div>}<fieldset disabled={busy||loading} className="client-fieldset"><legend className="sr-only">Pagesa hyrëse dhe ndarja në faza</legend>{detail?<p>Projekti: {detail.projectName}. Pagesat nuk mund të kalohen ndërmjet projekteve.</p>:<><div className="payment-project-selection"><ExpensePicker kind="project" required value={choice} disabled={busy||loading} onChange={chooseProject}/>{loading&&<p className="selection-loading" role="status"><span className="workspace-spinner" aria-hidden="true"/>Duke ngarkuar kontratën dhe fazat…</p>}{choice&&!selected&&!loading&&<Button type="button" className="client-secondary" onClick={()=>void load()}>Provoni ngarkimin përsëri</Button>}{selected&&<p className="selection-ready"><span aria-hidden="true">✓</span>Kontrata dhe fazat janë gati për pagesë.</p>}</div></>}<div className="form-section-heading"><span>01</span><div><h2>Të dhënat e pagesës</h2><p>Shuma, data e pranimit dhe mënyra e pagesës.</p></div></div><div className="client-form-grid">{([['amount',"Shuma (EUR, e detyrueshme)",amount,setAmount],['transactionDate',"Data reale e pranimit (e detyrueshme)",date,setDate]]as const).map(([key,label,value,set])=><FormField key={key} htmlFor={`payment-${key}`} label={label}><Input id={`payment-${key}`} name={key} required type={key==="transactionDate"?"date":"text"} inputMode={key==="amount"?"decimal":undefined} min={key==="transactionDate"?"1000-01-01":undefined} max={key==="transactionDate"?"9999-12-31":undefined} maxLength={key==="amount"?20:10} value={value} onChange={e=>set(e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`payment-${key}-error`:undefined}/>{errors[key]&&<p className="client-field-error" id={`payment-${key}-error`}>{errors[key]}</p>}</FormField>)}<PaymentMethod value={method} onChange={setMethod} disabled={busy}/></div>{project&&selected&&<><h2>Ndarja në faza financiare</h2><p>{project.clientName} · Kontrata {project.contract.totalValue} EUR</p>{!project.eligible&&<p role="alert">Ky projekt, klient ose kontratë nuk lejon më konfirmime të reja.</p>}<p className="muted">Kapaciteti i mbetur merr parasysh pagesat ekzistuese. Lërini bosh fazat e papërdorura; çdo ndarje e plotësuar duhet të jetë pozitive.</p><AllocationEditor {...{project,amount,values,detail,errors,total,difference}} onChange={setValues} disabled={busy}/><p role="status" className="sr-only">Shuma e ndarjes: {total} EUR · Diferenca ndaj pagesës: {difference}{/^-?\d+\.\d{2}$/.test(difference)?" EUR":""}</p>{errors.allocations&&<p role="alert" className="client-field-error">{errors.allocations}</p>}</>}{detail&&<label className="client-checkbox"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Konfirmoj korrigjimin e pagesës dhe krijimin e një versioni të ri të pandryshueshëm PDF me të njëjtin numër dëftese.</label>}<div className="client-actions"><Button className="client-secondary" type="submit" value="check" disabled={!selected||!project?.eligible||busy}>{busy?"Duke kontrolluar…":"Kontrolloni ndarjen"}</Button><Button type="submit" value="confirm" aria-label={detail?"Ruani korrigjimin dhe versionin e ri të dëftesës":"Konfirmoni pagesën dhe lëshoni dëftesën"} disabled={!selected||!project?.eligible||busy||difference!=="0.00"||total==="0.00"}>{detail?"Ruani korrigjimin":"Konfirmoni pagesën"}</Button><Link className="text-link" href={detail?`/app/payments/${detail.payment.id}`:"/app/payments"}>Kthehu</Link></div><div className="payment-assistance">{!detail&&<Button type="button" className="client-secondary payment-recovery-button" disabled={busy} onClick={()=>void recover()}>Rikuperoni / riprovoni konfirmimin e fundit</Button>}</div><p className="muted payment-legal-note">Formati dhe numërimi i dëftesës janë rregulla operative të zhvillimit; miratimi kontabël mbetet në pritje.</p></fieldset></form></Card>;
}
export function PaymentFilters({query}:{query:ReturnType<typeof parsePaymentQuery>}){
  const [choice,setChoice]=useState<ExpenseChoice|null>(query.projectId?{id:query.projectId,label:`Projekti ${query.projectId.slice(0,8)}`,version:1}:null);
  const {form,pending:busy,onSubmit,onInput}=useFilterNavigation('/app/payments');
  return <form action="/app/payments" method="get" className="workspace-list-filters ledger-filter-form" aria-busy={busy} ref={form} onSubmit={onSubmit} onInput={onInput}><div className="client-form-grid"><FormField htmlFor="payment-q" label="Kërkoni projektin, klientin, pagesën ose numrin e dëftesës"><Input id="payment-q" name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="Shkruani për të kërkuar menjëherë…"/></FormField></div><FilterPanel active={Boolean(query.from||query.to||query.status!=="received"||query.method!=="all"||query.projectId)}><div className="client-form-grid">{(["from","to"]as const).map(key=><FormField key={key} htmlFor={`payment-${key}`} label={key==="from"?"Data e pranimit nga":"Data e pranimit deri më"}><Input id={`payment-${key}`} name={key} type="date" min="1000-01-01" max="9999-12-31" defaultValue={query[key]}/></FormField>)}<FormField htmlFor="payment-filter-method" label="Mënyra"><select className="input" id="payment-filter-method" name="method" defaultValue={query.method}><option value="all">Të gjitha mënyrat</option><option value="cash">Para në dorë</option><option value="bank">Transfer bankar</option></select></FormField><FormField htmlFor="payment-filter-status" label="Gjendja"><select className="input" id="payment-filter-status" name="status" defaultValue={query.status}><option value="received">Pranuar</option><option value="cancelled">Anuluar</option><option value="all">Të gjitha gjendjet</option></select></FormField></div><div className="filter-relations"><ExpensePicker kind="project" historical value={choice} onChange={setChoice}/><input type="hidden" name="projectId" value={choice?.id??""}/></div></FilterPanel><div className="client-actions"><Button type="submit" disabled={busy}>{busy?"Duke kërkuar…":"Zbatoni filtrat"}</Button><Link className="text-link" href="/app/payments">Pastroni filtrat</Link></div></form>;
}
