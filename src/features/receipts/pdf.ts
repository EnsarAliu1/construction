import PDFDocument from "pdfkit";
import {resolve} from "node:path";
import type {HistorySnapshot} from "@/server/db/history-snapshot";

/** Layout accepts only a persisted scalar snapshot, never HTML or external URLs. */
export async function renderReceiptPdf(snapshot:HistorySnapshot):Promise<Buffer>{
  const doc=new PDFDocument({size:"A4",margins:{top:48,left:48,right:48,bottom:56},bufferPages:true,info:{Title:`Dëftesë JO-FISKALE ${snapshot.receiptNumber}`,Author:String(snapshot.companyName),Subject:"Dëftesë operative - miratimi kontabël në pritje"}});
  doc.registerFont("Receipt",resolve("assets/fonts/NotoSans-Regular.ttf"));
  doc.registerFont("ReceiptBold",resolve("assets/fonts/NotoSans-Bold.ttf"));
  const chunks:Buffer[]=[];
  const completed=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  function line(label:string,value:unknown){
    const content=String(value??"Nuk është regjistruar"),height=doc.font("Receipt").fontSize(10).heightOfString(content,{width:499});
    if(doc.y+height+32>780)doc.addPage();
    doc.font("ReceiptBold").fontSize(8).fillColor("#59636c").text(label.toUpperCase());
    doc.font("Receipt").fontSize(10).fillColor("#14212a").text(content,{width:499,lineGap:2});doc.moveDown(.65);
  }
  try{
    doc.font("ReceiptBold").fontSize(11).fillColor("#59636c").text("JO-FISKALE / DOKUMENT OPERATIV");
    doc.moveDown(.5).fontSize(20).fillColor("#14212a").text("Dëftesë pagese");
    doc.moveDown(.5);line("Kompania",snapshot.companyName);
    line("Numri i dëftesës",snapshot.receiptNumber);line("Versioni i dokumentit",snapshot.documentVersion);
    line("Lëshuar më (UTC)",snapshot.issuedAt);line("Klienti",snapshot.clientName);line("Projekti",snapshot.projectName);
    if(snapshot.location)line("Vendi / Lokacioni",snapshot.location);
    line("Shuma e pranuar",`${snapshot.amount} EUR`);line("Mënyra e pagesës",snapshot.method==="cash"?"Para në dorë":"Transfer bankar");
    line("Data reale e transaksionit",snapshot.transactionDate);line("Referenca e pagesës",snapshot.paymentId);
    line("Rishikimi i pagesës",snapshot.paymentVersion);
    if(Number(snapshot.documentVersion)>1)line("Korrigjimi","Version i korrigjuar. Dokumentet e mëparshme të pandryshueshme ruhen në historikun e dëftesës me të njëjtin numër.");
    line("Ndarja në faza financiare (EUR)",snapshot.allocationsText);
    line("Lëshuar nga",snapshot.issuerName);
    doc.font("Receipt").fontSize(9).fillColor("#59636c").text("Dokument operativ JO-FISKAL. Përmbajtja tatimore e kontabël dhe formati i numërimit presin miratimin e kontabilistit dhe përgjegjësit të projektit. Ky dokument nuk dëshmon certifikim fiskal. Kontrolloni gjendjen aktuale të dëftesës para përdorimit të versionit historik.",{width:499});
    const range=doc.bufferedPageRange();
    for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font("Receipt").fontSize(8).fillColor("#59636c").text(`JO-FISKALE | ${snapshot.receiptNumber} | v${snapshot.documentVersion} | ${i+1}/${range.count}`,48,805,{width:499,lineBreak:false});doc.page.margins.bottom=bottom;}
    doc.end();return await completed;
  }catch(error){doc.destroy(error instanceof Error?error:new Error("Gjenerimi i PDF-së dështoi"));await completed.catch(()=>{});throw new Error("Gjenerimi i PDF-së së dëftesës dështoi.");}
}
