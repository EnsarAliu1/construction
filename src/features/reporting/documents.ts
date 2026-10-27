import "server-only";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {resolve} from "node:path";
import type {FinanceReport} from "./finance";
import {limitError} from "./validation";
export function companyName(){const value=process.env.RECEIPT_COMPANY_NAME?.trim()||"Company name not configured - DEVELOPMENT ONLY";if(value.length>200||/[\u0000-\u001f\u007f]/u.test(value))throw new Error("Invalid company configuration.");return value;}
export async function operationalPdf(title:string,sections:{heading:string;lines:string[];table?:{headers:string[];rows:string[][]}}[]):Promise<Buffer>{
 const doc=new PDFDocument({size:"A4",margins:{top:48,bottom:56,left:48,right:48},bufferPages:true,info:{Title:title,Author:companyName()}});
 doc.registerFont("Body",resolve("assets/fonts/NotoSans-Regular.ttf"));doc.registerFont("Bold",resolve("assets/fonts/NotoSans-Bold.ttf"));
 const chunks:Buffer[]=[];let size=0;const done=new Promise<Buffer>((yes,no)=>{doc.on("data",chunk=>{size+=chunk.length;if(size>16*1024*1024)doc.destroy(limitError());else chunks.push(Buffer.from(chunk));});doc.on("error",no);doc.on("end",()=>yes(Buffer.concat(chunks)));});
 try{
  doc.font("Bold").fontSize(9).fillColor("#586570").text("NON-FISCAL / RAPORT OPERACIONAL");doc.moveDown().fontSize(20).fillColor("#14212a").text(title);doc.moveDown().fontSize(11).text(companyName());
  for(const section of sections){if(doc.y+50>doc.page.height-doc.page.margins.bottom)doc.addPage();doc.moveDown().font("Bold").fontSize(12).fillColor("#14212a").text(section.heading,{width:499});doc.moveDown(.4);
   if(section.table){const widths=[350,149];const row=(cells:string[],header=false)=>{doc.font(header?"Bold":"Body").fontSize(9);const height=Math.max(24,...cells.map((cell,i)=>doc.heightOfString(cell,{width:widths[i]-12})+12)),top=doc.y;let x=48;for(let i=0;i<cells.length;i++){doc.rect(x,top,widths[i],height).fillAndStroke(header?"#163a46":"#f4f7f8","#d8e0e3");doc.fillColor(header?"#ffffff":"#14212a").text(cells[i],x+6,top+6,{width:widths[i]-12,lineGap:1,align:i===1?"right":"left"});x+=widths[i];}doc.y=top+height;doc.x=48;};row(section.table.headers,true);for(const cells of section.table.rows){if(doc.y+30>doc.page.height-doc.page.margins.bottom){doc.addPage();row(section.table.headers,true);}row(cells);}doc.moveDown();}
   for(const line of section.lines){doc.font("Body").fontSize(9).fillColor("#14212a").text(line,{width:499,lineGap:2});doc.moveDown(.45);}}
  const range=doc.bufferedPageRange();if(range.count>300)throw limitError();for(let p=0;p<range.count;p++){doc.switchToPage(p);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font("Body").fontSize(8).fillColor("#586570").text(`NON-FISCAL | ${p+1}/${range.count}`,48,805,{width:499,lineBreak:false});doc.page.margins.bottom=bottom;}
  doc.end();return await done;
 }catch(error){doc.destroy(error instanceof Error?error:new Error("Report failed"));await done.catch(()=>{});throw error;}
}
export function reportScope(r:FinanceReport){return [`Created/snapshot UTC: ${r.generatedAt}`,`Actual transaction dates: ${r.filter.from||"all dates"} to ${r.filter.to||"all dates"}`,`Income method: ${r.filter.method}; expense category: ${r.filter.categoryId||"all"}`,"Current corrected states; cancelled records excluded. Not a historical state-as-of reconstruction.","Method filters income only. Category filters expenses only. Company-wide expenses remain included.","Income-minus-expenses is an operational difference, not statutory profit."];}
export async function companyPdf(r:FinanceReport){return operationalPdf("Company financial report",[
 {heading:"Scope and interpretation",lines:reportScope(r)},
 {heading:"Summary (EUR)",lines:[],table:{headers:["Measure","Exact EUR"],rows:[["Active received income",r.totals.income],["Active recorded expenses",r.totals.expenses],["Income-minus-expenses / Diferenca hyrje-dalje",r.totals.difference],["Company-wide expenses included",r.totals.companyExpenses]]}},
 {heading:`Incoming payments (${r.income.length})`,lines:r.income.length?r.income.map(p=>`${p.transactionDate} | ${p.amount} EUR | ${p.method}\nProject: ${p.projectName} | Client: ${p.clientName}\nPayment: ${p.id}`):["No qualifying received payments."]},
 {heading:`Recorded expenses (${r.outgoing.length})`,lines:r.outgoing.length?r.outgoing.map(e=>`${e.transactionDate} | ${e.amount} EUR | ${e.categoryName}\n${e.projectId?"Project: "+e.projectName:"Company-wide expense (not assigned to projects)"}\n${e.description}\nExpense: ${e.id}`):["No qualifying recorded expenses."]},
 {heading:"Company breakdown by project (EUR)",lines:[...r.breakdowns.map(p=>`${p.name} | received ${p.income} | directly linked expenses ${p.expenses}`),`Unassigned company-wide expenses: ${r.totals.companyExpenses}`]},
 {heading:"Accounting approval",lines:["Operational, non-fiscal report. Accounting treatment and report wording require accountant/PM validation. This report is not a numbered payment receipt."]}
 ]);}
export async function companyXlsx(r:FinanceReport){
 const book=new ExcelJS.Workbook();book.creator=companyName();book.created=new Date(r.generatedAt);
 const sheet=(name:string,headers:string[],rows:(string|number)[][])=>{
  const s=book.addWorksheet(name,{views:[{state:"frozen",ySplit:1}],properties:{defaultRowHeight:24}});s.addRow(headers);for(const row of rows)s.addRow(row);
  s.columns.forEach((column,i)=>{column.width=i===0?26:36;column.numFmt="@";});s.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};s.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF163A46"}};
  if(name==="Metadata")s.getColumn(2).width=95;if(name==="Expenses")s.getColumn(5).width=60;
  s.eachRow(row=>{row.alignment={vertical:"top",wrapText:true};row.height=row.number===1?32:Math.min(409,Math.max(28,...Object.values(row.values).map(value=>Math.ceil(String(value??"").length/32)*15+8)));row.eachCell(cell=>{if(typeof cell.value==="string"&&cell.value.length>32767)throw limitError();});});s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};return s;
 };
 sheet("Summary",["Measure","Exact EUR / value"],[["Company",companyName()],["Received income",r.totals.income],["Recorded expenses",r.totals.expenses],["Operational difference",r.totals.difference],["Company-wide expenses",r.totals.companyExpenses],["Payment count",r.income.length],["Expense count",r.outgoing.length]]);
 sheet("Payments",["Payment ID","Transaction date","Project","Client","Method","Exact EUR"],r.income.map(p=>[String(p.id),String(p.transactionDate),String(p.projectName),String(p.clientName),String(p.method),String(p.amount)]));
 sheet("Expenses",["Expense ID","Transaction date","Project / Company-wide","Category","Description","Exact EUR"],r.outgoing.map(e=>[String(e.id),String(e.transactionDate),String(e.projectName),String(e.categoryName),String(e.description),String(e.amount)]));
 sheet("Project breakdown",["Project ID","Project","Received EUR","Direct expenses EUR"],[...r.breakdowns.map(p=>[p.id,p.name,p.income,p.expenses]),["","Company-wide (unassigned)","0.00",r.totals.companyExpenses]]);
 sheet("Categories",["Category ID","Category","Recorded EUR"],r.categories.map(c=>[c.id,c.name,c.amount]));sheet("Payment methods",["Method","Received EUR"],r.methods.map(m=>[m.method,m.amount]));
 sheet("Metadata",["Property","Value"],[...reportScope(r).map((line,i)=>[String(i+1),line]),["Money precision","Exact decimal TEXT, including totals. No floating-point totals or executable formulas. Dates are ISO calendar text; IDs remain text."],["Export schema","fitimi-company-report/1"],["Policy","Company-wide report only; no individual project financial exports."]]);
 const bytes=Buffer.from(await book.xlsx.writeBuffer());if(bytes.length>16*1024*1024)throw limitError();return bytes;
}
