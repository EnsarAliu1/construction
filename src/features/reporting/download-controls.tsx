"use client";
import {useRef,useState} from "react";
import type {ReportFilter} from "./validation";
export function DownloadControls({filters,full=false}:{filters?:ReportFilter;full?:boolean}){
 const [pending,setPending]=useState(""),[message,setMessage]=useState(""),[confirmed,setConfirmed]=useState(false),flight=useRef(false);
 async function download(format:string){if(flight.current)return;flight.current=true;setPending(format);setMessage("");try{
  const response=await fetch(full?"/api/exports/business":"/api/reports/company",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(full?{confirmation:"export-all"}:{format,filters})});
  if(!response.ok){const body=await response.json();throw new Error(body.message??"Export failed. Retry safely.");}
  const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=full?"complete-business-data.zip":`company-financial-report.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage("Export prepared. Check your browser downloads; keep business data secure.");
 }catch(error){setMessage(error instanceof Error?error.message:"Export unavailable. Retry safely.");}finally{flight.current=false;setPending("");}}
 return <div className="report-downloads">{full&&<label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!!pending}/> I understand this ZIP contains sensitive business, personal and historical data.</label>}<div className="page-actions">{(full?["zip"]:["pdf","xlsx"]).map(format=><button className="button" type="button" key={format} disabled={!!pending||(full&&!confirmed)} onClick={()=>void download(format)}>{pending===format?"Preparing complete snapshot...":full?"Export complete business data (ZIP)":`Download company ${format.toUpperCase()}`}</button>)}</div><p role="status" aria-live="polite">{message|| (pending?"Preparing and verifying the export. Please wait.":"")}</p></div>;
}
