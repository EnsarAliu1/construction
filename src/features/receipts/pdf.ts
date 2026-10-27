import PDFDocument from "pdfkit";
import {resolve} from "node:path";
import type {HistorySnapshot} from "@/server/db/history-snapshot";

/** Layout accepts only a persisted scalar snapshot, never HTML or external URLs. */
export async function renderReceiptPdf(snapshot:HistorySnapshot):Promise<Buffer>{
  const doc=new PDFDocument({size:"A4",margins:{top:48,left:48,right:48,bottom:56},bufferPages:true,info:{Title:`NON-FISCAL Receipt ${snapshot.receiptNumber}`,Author:String(snapshot.companyName),Subject:"Operational receipt - accountant approval outstanding"}});
  doc.registerFont("Receipt",resolve("assets/fonts/NotoSans-Regular.ttf"));
  doc.registerFont("ReceiptBold",resolve("assets/fonts/NotoSans-Bold.ttf"));
  const chunks:Buffer[]=[];
  const completed=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  function line(label:string,value:unknown){
    const content=String(value??"Not recorded"),height=doc.font("Receipt").fontSize(10).heightOfString(content,{width:499});
    if(doc.y+height+32>780)doc.addPage();
    doc.font("ReceiptBold").fontSize(8).fillColor("#59636c").text(label.toUpperCase());
    doc.font("Receipt").fontSize(10).fillColor("#14212a").text(content,{width:499,lineGap:2});doc.moveDown(.65);
  }
  try{
    doc.font("ReceiptBold").fontSize(11).fillColor("#59636c").text("NON-FISCAL / DOCUMENT OPERACIONAL");
    doc.moveDown(.5).fontSize(20).fillColor("#14212a").text("Dëftesë pagese / Payment receipt");
    doc.moveDown(.5);line("Company",snapshot.companyName);
    line("Receipt number",snapshot.receiptNumber);line("Document version",snapshot.documentVersion);
    line("Issued at (UTC)",snapshot.issuedAt);line("Client",snapshot.clientName);line("Project",snapshot.projectName);
    if(snapshot.location)line("Site / location",snapshot.location);
    line("Amount received",`${snapshot.amount} EUR`);line("Payment method",snapshot.method==="cash"?"Cash / Para në dorë":"Bank transfer / Transfer bankar");
    line("Actual transaction date",snapshot.transactionDate);line("Payment reference",snapshot.paymentId);
    line("Payment revision",snapshot.paymentVersion);
    if(Number(snapshot.documentVersion)>1)line("Correction","Corrected version. Earlier immutable documents remain in the receipt history under the same number.");
    line("Financial phase allocations (EUR)",snapshot.allocationsText);
    line("Issued by",snapshot.issuerName);
    doc.font("Receipt").fontSize(9).fillColor("#59636c").text("NON-FISCAL operational document. Tax/accounting wording and numbering format await accountant/PM validation. This document makes no fiscal certification claim. Consult current receipt status before relying on a historical version.",{width:499});
    const range=doc.bufferedPageRange();
    for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font("Receipt").fontSize(8).fillColor("#59636c").text(`NON-FISCAL | ${snapshot.receiptNumber} | v${snapshot.documentVersion} | ${i+1}/${range.count}`,48,805,{width:499,lineBreak:false});doc.page.margins.bottom=bottom;}
    doc.end();return await completed;
  }catch(error){doc.destroy(error instanceof Error?error:new Error("PDF generation failed"));await completed.catch(()=>{});throw new Error("Receipt PDF generation failed.");}
}
