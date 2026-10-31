import {kosovoDate,groupedDecimal,includedVat} from "@/lib/presentation";
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
    doc.image(resolve("public/logos/fitimi-clean.png"),48,44,{fit:[145,62]});
    doc.font("ReceiptBold").fontSize(23).fillColor("#163a43").text("DËFTESË PAGESE",240,48,{width:307,align:"right"});
    doc.font("Receipt").fontSize(9).fillColor("#59636c").text(`Nr. ${snapshot.receiptNumber}  |  Versioni ${snapshot.documentVersion}`,240,85,{width:307,align:"right"});
    doc.text(`Lëshuar: ${kosovoDate(snapshot.issuedAt)}`,240,101,{width:307,align:"right"});
    doc.moveTo(48,132).lineTo(547,132).strokeColor("#c6d8d8").stroke();doc.x=48;doc.y=149;
    line("Nga",snapshot.companyName);line("Pranuar nga / Klienti",snapshot.clientName);
    line("Projekti",snapshot.projectName);if(snapshot.location)line("Lokacioni",snapshot.location);
    line("Data e pagesës / Mënyra",`${kosovoDate(snapshot.transactionDate)} / ${snapshot.method==="cash"?"Para në dorë":"Transfer bankar"}`);
    doc.moveDown(.4);doc.font("ReceiptBold").fontSize(10).fillColor("#163a43").text("PËRSHKRIMI / NDARJA NË FAZA");doc.moveDown(.5);
    line("Fazat financiare (EUR)",snapshot.allocationsText);
    const tax=includedVat(String(snapshot.amount));
    if(doc.y+160>760)doc.addPage();
    doc.moveDown(.5);const top=doc.y;
    doc.rect(295,top,252,100).fill("#eef5f2");
    const totalLine=(label:string,value:string,y:number,bold=false)=>{doc.font(bold?"ReceiptBold":"Receipt").fontSize(bold?12:10).fillColor("#163a43").text(label,309,y,{width:123});const amount=`${groupedDecimal(value)} EUR`;let size=bold?12:10;while(doc.widthOfString(amount)>105&&size>7)doc.fontSize(--size);doc.text(amount,427,y,{width:105,align:"right"});};
    totalLine("Baza pa TVSH",tax.net,top+12);totalLine("TVSH 18% (brenda)",tax.vat,top+38);totalLine("Totali i pranuar",tax.gross,top+69,true);
    doc.x=48;doc.y=top+118;
    if(Number(snapshot.documentVersion)>1)line("Korrigjimi","Version i korrigjuar; versionet e mëparshme ruhen të pandryshuara.");
    line("Lëshuar nga",snapshot.issuerName);
    line("Referenca / rishikimi i pagesës",`${snapshot.paymentId} / ${snapshot.paymentVersion}`);
    if(doc.y+96>780)doc.addPage();
    const sign=doc.y+16;doc.moveTo(48,sign).lineTo(238,sign).moveTo(357,sign).lineTo(547,sign).strokeColor("#c6d8d8").stroke();
    doc.font("Receipt").fontSize(9).fillColor("#59636c").text("Dorëzoi",48,sign+7).text("Pranoi",357,sign+7);doc.x=48;doc.y=sign+34;
    doc.fontSize(8).text("Dokument operativ JO-FISKAL. TVSH 18% paraqitet e përfshirë në total, pa shtesë mbi pagesën. Përmbajtja tatimore dhe kontabël pret miratimin e kontabilistit. Kontrolloni gjendjen aktuale para përdorimit të versionit historik.",{width:499});
    const range=doc.bufferedPageRange();
    for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font("Receipt").fontSize(8).fillColor("#59636c").text(`JO-FISKALE | ${snapshot.receiptNumber} | v${snapshot.documentVersion} | ${i+1}/${range.count}`,48,805,{width:499,lineBreak:false});doc.page.margins.bottom=bottom;}
    doc.end();return await completed;
  }catch(error){doc.destroy(error instanceof Error?error:new Error("Gjenerimi i PDF-së dështoi"));await completed.catch(()=>{});throw new Error("Gjenerimi i PDF-së së dëftesës dështoi.");}
}
