"use client";
import {notifySuccess} from "@/components/workspace/success-toast";
import {useRef,useState} from "react";
import {reportPeriod} from "./period";
import type {ReportFilter} from "./validation";
export function DownloadControls({filters,full=false}:{filters?:ReportFilter;full?:boolean}){
 const [pending,setPending]=useState(""),[message,setMessage]=useState(""),[confirmed,setConfirmed]=useState(false),flight=useRef(false);
 async function download(format:string){if(flight.current)return;flight.current=true;setPending(format);setMessage("");try{
  const response=await fetch(full?"/api/exports/business":"/api/reports/company",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(full?{confirmation:"export-all"}:{format,filters})});
  if(!response.ok){const body=await response.json();throw new Error(body.message??"Eksporti dështoi. Provoni përsëri në mënyrë të sigurt.");}
  const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=full?"te-dhenat-e-biznesit.zip":`${filters?reportPeriod(filters).file:"raporti-financiar-i-kompanise"}${filters?.categoryId?"-kategori":""}${filters&&filters.method!=="all"?"-"+filters.method:""}.${format}`;document.body.append(a);a.click();a.remove();notifySuccess("Raporti u përgatit për shkarkim.");setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage("Eksporti u përgatit. Kontrolloni shkarkimet e shfletuesit; ruajini të dhënat e biznesit në mënyrë të sigurt.");
 }catch(error){setMessage(error instanceof Error?error.message:"Eksporti është i padisponueshëm. Provoni përsëri në mënyrë të sigurt.");}finally{flight.current=false;setPending("");}}
 return <div className="report-downloads">{full&&<label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!!pending}/> E kuptoj që ky ZIP përmban të dhëna të ndjeshme të biznesit, personale dhe historike.</label>}<div className="page-actions">{(full?["zip"]:["pdf","xlsx"]).map(format=><button className="button" type="button" key={format} disabled={!!pending||(full&&!confirmed)} onClick={()=>void download(format)}>{pending===format?"Duke përgatitur gjendjen e plotë...":full?"Eksportoni të gjitha të dhënat e biznesit (ZIP)":`Shkarkoni raportin e kompanisë ${format.toUpperCase()}`}</button>)}</div><p role="status" aria-live="polite">{message|| (pending?"Duke përgatitur dhe verifikuar eksportin. Ju lutemi, prisni.":"")}</p></div>;
}
