import {valueLabel} from "@/i18n/format";
import "server-only";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {resolve} from "node:path";
import type {FinanceReport} from "./finance";
import {limitError} from "./validation";
export function companyName(){const value=process.env.RECEIPT_COMPANY_NAME?.trim()||"Emri i kompanisë nuk është konfiguruar - VETËM PËR ZHVILLIM";if(value.length>200||/[\u0000-\u001f\u007f]/u.test(value))throw new Error("Konfigurimi i kompanisë është i pavlefshëm.");return value;}
export async function operationalPdf(title:string,sections:{heading:string;lines:string[];table?:{headers:string[];rows:string[][]}}[]):Promise<Buffer>{
 const doc=new PDFDocument({size:"A4",margins:{top:48,bottom:56,left:48,right:48},bufferPages:true,info:{Title:title,Author:companyName()}});
 doc.registerFont("Body",resolve("assets/fonts/NotoSans-Regular.ttf"));doc.registerFont("Bold",resolve("assets/fonts/NotoSans-Bold.ttf"));
 const chunks:Buffer[]=[];let size=0;const done=new Promise<Buffer>((yes,no)=>{doc.on("data",chunk=>{size+=chunk.length;if(size>16*1024*1024)doc.destroy(limitError());else chunks.push(Buffer.from(chunk));});doc.on("error",no);doc.on("end",()=>yes(Buffer.concat(chunks)));});
 try{
  doc.font("Bold").fontSize(9).fillColor("#586570").text("JO-FISKALE / RAPORT OPERATIV");doc.moveDown().fontSize(20).fillColor("#14212a").text(title);doc.moveDown().fontSize(11).text(companyName());
  for(const section of sections){if(doc.y+50>doc.page.height-doc.page.margins.bottom)doc.addPage();doc.moveDown().font("Bold").fontSize(12).fillColor("#14212a").text(section.heading,{width:499});doc.moveDown(.4);
   if(section.table){const widths=[350,149];const row=(cells:string[],header=false)=>{doc.font(header?"Bold":"Body").fontSize(9);const height=Math.max(24,...cells.map((cell,i)=>doc.heightOfString(cell,{width:widths[i]-12})+12)),top=doc.y;let x=48;for(let i=0;i<cells.length;i++){doc.rect(x,top,widths[i],height).fillAndStroke(header?"#163a46":"#f4f7f8","#d8e0e3");doc.fillColor(header?"#ffffff":"#14212a").text(cells[i],x+6,top+6,{width:widths[i]-12,lineGap:1,align:i===1?"right":"left"});x+=widths[i];}doc.y=top+height;doc.x=48;};row(section.table.headers,true);for(const cells of section.table.rows){if(doc.y+30>doc.page.height-doc.page.margins.bottom){doc.addPage();row(section.table.headers,true);}row(cells);}doc.moveDown();}
   for(const line of section.lines){doc.font("Body").fontSize(9).fillColor("#14212a").text(line,{width:499,lineGap:2});doc.moveDown(.45);}}
  const range=doc.bufferedPageRange();if(range.count>300)throw limitError();for(let p=0;p<range.count;p++){doc.switchToPage(p);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font("Body").fontSize(8).fillColor("#586570").text(`JO-FISKALE | ${p+1}/${range.count}`,48,805,{width:499,lineBreak:false});doc.page.margins.bottom=bottom;}
  doc.end();return await done;
 }catch(error){doc.destroy(error instanceof Error?error:new Error("Raporti dështoi"));await done.catch(()=>{});throw error;}
}
export function reportScope(r:FinanceReport){return [`Krijuar / gjendja e ruajtur UTC: ${r.generatedAt}`,`Datat reale të transaksioneve: ${r.filter.from||"të gjitha datat"} deri më ${r.filter.to||"të gjitha datat"}`,`Mënyra e të hyrave: ${valueLabel(r.filter.method)}; kategoria e shpenzimit: ${r.filter.categoryId||"të gjitha"}`,"Gjendja aktuale e korrigjuar; të dhënat e anuluara nuk përfshihen. Nuk rindërtohet gjendja historike në një datë të caktuar.","Mënyra filtron vetëm të hyrat. Kategoria filtron vetëm shpenzimet. Shpenzimet e përgjithshme të kompanisë përfshihen.","Diferenca të hyra minus shpenzime është tregues operativ, jo fitim kontabël."];}
export async function companyPdf(r:FinanceReport){return operationalPdf("Raporti financiar i kompanisë",[
 {heading:"Përfshirja dhe interpretimi",lines:reportScope(r)},
 {heading:"Përmbledhja (EUR)",lines:[],table:{headers:["Treguesi","EUR të sakta"],rows:[["Të hyrat aktive të pranuara",r.totals.income],["Shpenzimet aktive të regjistruara",r.totals.expenses],["Diferenca hyrje-dalje",r.totals.difference],["Shpenzimet e kompanisë të përfshira",r.totals.companyExpenses]]}},
 {heading:`Pagesat hyrëse (${r.income.length})`,lines:r.income.length?r.income.map(p=>`${p.transactionDate} | ${p.amount} EUR | ${valueLabel(String(p.method))}
Projekti: ${p.projectName} | Klienti: ${p.clientName}
Pagesa: ${p.id}`):["Nuk ka pagesa të pranuara sipas kushteve."]},
 {heading:`Shpenzimet e regjistruara (${r.outgoing.length})`,lines:r.outgoing.length?r.outgoing.map(e=>`${e.transactionDate} | ${e.amount} EUR | ${e.categoryName}\n${e.projectId?"Projekti: "+e.projectName:"Shpenzim i kompanisë (pa projekt)"}\n${e.description}
Shpenzimi: ${e.id}`):["Nuk ka shpenzime të regjistruara sipas kushteve."]},
 {heading:"Ndarja e kompanisë sipas projekteve (EUR)",lines:[...r.breakdowns.map(p=>`${p.name} | pranuar ${p.income} | shpenzime të lidhura drejtpërdrejt ${p.expenses}`),`Shpenzimet e kompanisë pa projekt: ${r.totals.companyExpenses}`]},
 {heading:"Miratimi kontabël",lines:["Raport operativ, jo-fiskal. Trajtimi kontabël dhe përmbajtja kërkojnë miratimin e kontabilistit dhe përgjegjësit të projektit. Ky raport nuk është dëftesë pagese me numër."]}
 ]);}
export async function companyXlsx(r:FinanceReport){
 const book=new ExcelJS.Workbook();book.creator=companyName();book.created=new Date(r.generatedAt);
 const sheet=(name:string,headers:string[],rows:(string|number)[][])=>{
  const s=book.addWorksheet(name,{views:[{state:"frozen",ySplit:1}],properties:{defaultRowHeight:24}});s.addRow(headers);for(const row of rows)s.addRow(row);
  s.columns.forEach((column,i)=>{column.width=i===0?26:36;column.numFmt="@";});s.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};s.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF163A46"}};
  if(name==="Të dhënat shpjeguese")s.getColumn(2).width=95;if(name==="Shpenzimet")s.getColumn(5).width=60;
  s.eachRow(row=>{row.alignment={vertical:"top",wrapText:true};row.height=row.number===1?32:Math.min(409,Math.max(28,...Object.values(row.values).map(value=>Math.ceil(String(value??"").length/32)*15+8)));row.eachCell(cell=>{if(typeof cell.value==="string"&&cell.value.length>32767)throw limitError();});});s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};return s;
 };
 sheet("Përmbledhja",["Treguesi","EUR të sakta / vlera"],[["Kompania",companyName()],["Të hyrat e pranuara",r.totals.income],["Shpenzimet e regjistruara",r.totals.expenses],["Diferenca operative",r.totals.difference],["Shpenzimet e kompanisë",r.totals.companyExpenses],["Numri i pagesave",r.income.length],["Numri i shpenzimeve",r.outgoing.length]]);
 sheet("Pagesat",["Identifikuesi i pagesës","Data e transaksionit","Projekti","Klienti","Mënyra","EUR të sakta"],r.income.map(p=>[String(p.id),String(p.transactionDate),String(p.projectName),String(p.clientName),valueLabel(String(p.method)),String(p.amount)]));
 sheet("Shpenzimet",["Identifikuesi i shpenzimit","Data e transaksionit","Projekti / Kompania","Kategoria","Përshkrimi","EUR të sakta"],r.outgoing.map(e=>[String(e.id),String(e.transactionDate),String(e.projectName),String(e.categoryName),String(e.description),String(e.amount)]));
 sheet("Ndarja sipas projekteve",["Identifikuesi i projektit","Projekti","EUR të pranuara","Shpenzime të drejtpërdrejta në EUR"],[...r.breakdowns.map(p=>[p.id,p.name,p.income,p.expenses]),["","Kompania (pa projekt)","0.00",r.totals.companyExpenses]]);
 sheet("Kategoritë",["Identifikuesi i kategorisë","Kategoria","EUR të regjistruara"],r.categories.map(c=>[c.id,c.name,c.amount]));sheet("Mënyrat e pagesës",["Mënyra","EUR të pranuara"],r.methods.map(m=>[valueLabel(m.method),m.amount]));
 sheet("Të dhënat shpjeguese",["Vetia","Vlera"],[...reportScope(r).map((line,i)=>[String(i+1),line]),["Saktësia monetare","TEKST dhjetor i saktë, përfshirë totalet. Pa shuma me presje lëvizëse ose formula të ekzekutueshme. Datat janë tekst kalendarik ISO; identifikuesit mbeten tekst."],["Skema e eksportit","fitimi-company-report/1"],["Rregullat","Vetëm raport i kompanisë; nuk ka eksporte financiare për projekte individuale."]]);
 const bytes=Buffer.from(await book.xlsx.writeBuffer());if(bytes.length>16*1024*1024)throw limitError();return bytes;
}
