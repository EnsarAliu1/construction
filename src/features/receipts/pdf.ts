import {kosovoDate,groupedDecimal} from '@/lib/presentation';
import {cents} from '@/features/projects/money';
import PDFDocument from 'pdfkit';
import {resolve} from 'node:path';
import type {HistorySnapshot} from '@/server/db/history-snapshot';
import {receiptCompany,type ReceiptBuyer,type ReceiptCompany} from './company-profile';
import {receiptTax,receiptTaxLines} from './tax';

type ReceiptItem={description:string;amount:string};
type Presentation={company?:ReceiptCompany;buyer?:ReceiptBuyer;items?:ReceiptItem[]};
const ink='#182824',green='#17634c',muted='#63726b',line='#dbe4de',paper='#f3f6f3';

/** A receipt confirms a payment. It never becomes a tax invoice through a visual change. */
export async function renderReceiptPdf(snapshot:HistorySnapshot,presentation:Presentation={}):Promise<Buffer>{
 const company=presentation.company??receiptCompany(),buyer=presentation.buyer??{},amount=String(snapshot.amount);
 const doc=new PDFDocument({size:'A4',margins:{top:38,left:38,right:38,bottom:64},bufferPages:true,info:{Title:`Dëftesë pagese ${snapshot.receiptNumber}`,Author:String(snapshot.companyName),Subject:'Dëshmi e pagesës së pranuar'}});
 doc.registerFont('Body',resolve('assets/fonts/NotoSans-Regular.ttf'));doc.registerFont('Bold',resolve('assets/fonts/NotoSans-Bold.ttf'));
 const chunks:Buffer[]=[];let size=0;
 const completed=new Promise<Buffer>((yes,no)=>{doc.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024)doc.destroy(new Error('Dokumenti tejkalon kufirin e lejuar.'));else chunks.push(Buffer.from(chunk));});doc.on('end',()=>yes(Buffer.concat(chunks)));doc.on('error',no);});
 const left=38,width=519.28,right=left+width,bottom=752;
 const text=(value:unknown,x:number,y:number,w:number,fontSize=9,bold=false,color=ink,align:'left'|'right'='left')=>doc.font(bold?'Bold':'Body').fontSize(fontSize).fillColor(color).text(String(value??''),x,y,{width:w,align,lineGap:2});
 const height=(value:string,w:number,fontSize=9,bold=false)=>doc.font(bold?'Bold':'Body').fontSize(fontSize).heightOfString(value,{width:w,lineGap:2});
 function nextPage(){doc.addPage();text(String(snapshot.companyName),left,32,330,10,true);text(`Dëftesë ${snapshot.receiptNumber}`,350,33,207,8,false,muted,'right');const separator=Math.max(61,32+height(String(snapshot.companyName),330,10,true)+12);doc.moveTo(left,separator).lineTo(right,separator).strokeColor(line).stroke();doc.x=left;doc.y=separator+16;}
 function ensure(space:number){if(doc.y+space>bottom)nextPage();}
 try{
  doc.image(company.logo,left,34,{fit:[35,49],valign:'center'});
  text(String(snapshot.companyName),85,35,248,15,true);text('DËFTESË PAGESE',335,37,222,19,true,green,'right');
  text(`Nr. ${snapshot.receiptNumber}  ·  v${snapshot.documentVersion??1}`,335,68,222,10,true,ink,'right');
  const sellerRows=[company.address,company.city,company.nui?`NUI / Nr. fiskal: ${company.nui}`:'NUI / Nr. fiskal: —',company.vatStatus==='registered'?`Nr. TVSH: ${company.vatNumber}`:company.vatStatus==='not-registered'?'Biznes i paregjistruar për TVSH':'Statusi i TVSH-së: i pakonfiguruar',[company.phone,company.email].filter(Boolean).join('  ·  '),company.bank?`Banka: ${company.bank}`:'',company.iban?`IBAN: ${company.iban}`:''].filter(Boolean);
  let sy=Math.max(104,35+height(String(snapshot.companyName),248,15,true)+18);
  text('KOMPANIA / PRANUESI I PAGESËS',left,sy-17,300,7,true,muted);
  for(const row of sellerRows){text(row,left,sy,300,8);sy+=height(row,300,8)+3;}
  let my=105;
  for(const [label,value]of [['Data e lëshimit',kosovoDate(snapshot.issuedAt)],['Data e pagesës',kosovoDate(snapshot.transactionDate)],['Mënyra e pagesës',snapshot.method==='cash'?'Para në dorë':'Transfer bankar']]){text(label,368,my,189,7,false,muted,'right');text(value,368,my+12,189,9,true,ink,'right');my+=height(value,189,9,true)+19;}
  doc.y=Math.max(sy,my)+13;doc.moveTo(left,doc.y).lineTo(right,doc.y).strokeColor(line).stroke();doc.y+=17;
  const buyerLines=[String(snapshot.clientName??'Klienti nuk është regjistruar'),[buyer.address,buyer.city].filter(Boolean).join(', '),`NUI / Nr. fiskal: ${buyer.nui||'—'}    |    Nr. TVSH: ${buyer.vatNumber||'—'}`].filter(Boolean);
  const buyerHeight=29+buyerLines.reduce((n,value,i)=>n+height(value,width-30,i===0?12:8.5,i===0)+5,0),by=doc.y;
  doc.roundedRect(left,by,width,buyerHeight,6).fill(paper);text('KLIENTI / PAGUESI',left+15,by+11,width-30,7,true,muted);
  let ty=by+29;for(const [i,value]of buyerLines.entries()){text(value,left+15,ty,width-30,i===0?12:8.5,i===0);ty+=height(value,width-30,i===0?12:8.5,i===0)+5;}
  doc.y=by+buyerHeight+14;
  if(snapshot.projectName){text('PROJEKTI',left,doc.y,60,7,true,muted);const project=String(snapshot.projectName)+(snapshot.location?'  ·  '+snapshot.location:'');text(project,left+70,doc.y-1,width-70,9,true);doc.y+=Math.max(26,height(project,width-70,9,true)+12);}
  const raw=String(snapshot.allocationsText??'').split('\n').filter(Boolean),parsed=raw.map(value=>{const match=/^(.*): (\d+\.\d{2}) EUR$/.exec(value);return match?{description:match[1],amount:match[2]}:null;});
  let items=presentation.items;
  if(!items&&parsed.length&&parsed.every((v):v is ReceiptItem=>v!==null)&&parsed.reduce((n,row)=>n+cents(row.amount),BigInt(0))===cents(amount))items=parsed;
  if(items&&items.reduce((n,row)=>n+cents(row.amount),BigInt(0))!==cents(amount))throw new Error('Ndarja e pagesës nuk përputhet me totalin.');
  const rows=items??[{description:String(snapshot.allocationsText||'Pagesë sipas projektit'),amount}];
  const taxable=company.vatStatus==='registered',taxes=taxable?receiptTaxLines(rows.map(row=>row.amount),company.vatRate):null;
  const widths=[22,152,46,32,61,36,60,110.28],headers=['Nr.','Faza / përshkrimi i pagesës','Njësia','Sasia','Baza pa TVSH (€)','TVSH %','Vlera TVSH (€)','Shuma e pranuar (€)'];
  function tableHeader(){ensure(41);const top=doc.y;let x=left;for(const [i,label]of headers.entries()){doc.rect(x,top,widths[i],39).fill(green);text(label,x+5,top+8,widths[i]-10,7,true,'#ffffff',i>2?'right':'left');x+=widths[i];}doc.y=top+39;doc.x=left;}
  if(rows.length){
   const first=rows[0],tax=taxes?.[0],firstCells=['1',first.description,'pagesë','1',tax?groupedDecimal(tax.net):'—',tax?String(tax.rate):'—',tax?groupedDecimal(tax.vat):'—',groupedDecimal(first.amount)];
   const firstHeight=Math.max(33,...firstCells.map((value,i)=>Math.min(238,height(value,widths[i]-12,8))+16));
   ensure(39+firstHeight+(rows.length===1&&height(first.description,widths[1]-12,8)<=238?235:0));
  }
  tableHeader();
  for(const [index,item]of rows.entries()){
   // Ordinary rows stay intact. Exceptionally tall descriptions continue explicitly.
   let description=item.description,fragment=0;
   do{
    let take=description.length;
    if(height(description,widths[1]-12,8)>238){let lo=1,hi=description.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(height(description.slice(0,mid),widths[1]-12,8)<=238)lo=mid;else hi=mid-1;}take=Math.max(1,lo);const boundary=description.lastIndexOf(' ',take);if(boundary>take/2)take=boundary;}
    const piece=description.slice(0,take),last=take===description.length,tax=taxes?.[index];
    const cells=[fragment?'↳':String(index+1),piece,'pagesë',last?'1':'',last&&tax?groupedDecimal(tax.net):'—',last&&tax?String(tax.rate):'—',last&&tax?groupedDecimal(tax.vat):'—',last?groupedDecimal(item.amount):''];
    const rowHeight=Math.max(33,...cells.map((value,i)=>height(value,widths[i]-12,8)+16));
    const closingSpace=index===rows.length-1&&last?235:0;
    if(doc.y+rowHeight+closingSpace>bottom){nextPage();tableHeader();}
    const top=doc.y;let x=left;for(const [i,value]of cells.entries()){doc.rect(x,top,widths[i],rowHeight).fill(index%2===0?'#f5f8f5':'#ffffff');text(value,x+6,top+8,widths[i]-12,8,i===7,ink,i>2?'right':'left');x+=widths[i];}
    doc.moveTo(left,top+rowHeight).lineTo(right,top+rowHeight).strokeColor(line).lineWidth(.5).stroke();doc.y=top+rowHeight;doc.x=left;
    description=description.slice(take).trimStart();fragment++;
   }while(description);
  }
  doc.y+=15;ensure(147);const summaryY=doc.y,boxX=295,boxWidth=right-boxX;
  text('PAGESË E REGJISTRUAR',left,summaryY+4,235,8,true,green);
  text('Shumat e këtij dokumenti vërtetojnë pagesën e pranuar. Njësia “pagesë” përfaqëson ndarjen në faza.',left,summaryY+23,231,8,false,muted);
  const note=taxable?(company.vatNote||'TVSH-ja paraqitet e përfshirë në pagesë, sipas profilit të kompanisë.'):company.vatStatus==='not-registered'?'TVSH nuk është llogaritur; profili është i paregjistruar për TVSH.':'TVSH nuk është llogaritur: statusi i kompanisë nuk është konfiguruar.';
  text(note,left,summaryY+65,231,7.5,false,muted);
  const total=receiptTax(amount,taxable?company.vatRate:0);
  doc.roundedRect(boxX,summaryY,boxWidth,126,6).fill(paper);
  const totalLine=(label:string,value:string,y:number,bold=false)=>{text(label,boxX+13,y,boxWidth-26,8,bold,bold?green:muted);let fontSize=bold?17:10;while(doc.font('Bold').fontSize(fontSize).widthOfString(value)>boxWidth-26&&fontSize>9)fontSize--;text(value,boxX+13,y+14,boxWidth-26,fontSize,true,ink,'right');};
  totalLine(taxable?'Baza pa TVSH':'Vlera e pagesës',`${groupedDecimal(total.net)} EUR`,summaryY+10);
  text(taxable?`TVSH ${company.vatRate}% (e përfshirë)`:'TVSH',boxX+13,summaryY+48,140,8,false,muted);text(taxable?`${groupedDecimal(total.vat)} EUR`:'—',boxX+13,summaryY+48,boxWidth-26,9,false,ink,'right');
  doc.moveTo(boxX+13,summaryY+72).lineTo(right-13,summaryY+72).strokeColor(line).stroke();
  totalLine('TOTALI I PRANUAR',`${groupedDecimal(amount)} EUR`,summaryY+81,true);
  doc.y=summaryY+145;ensure(75);
  const sign=doc.y+24;doc.moveTo(left,sign).lineTo(250,sign).moveTo(345,sign).lineTo(right,sign).strokeColor('#aebfb4').stroke();
  text('Lëshoi / Dorëzoi (Kompania)',left,sign+7,225,8,false,muted);text('Pranoi (Klienti)',345,sign+7,212,8,false,muted);
  text(String(snapshot.issuerName??''),left,sign+22,225,8);doc.y=sign+42;
  if(Number(snapshot.documentVersion)>1){ensure(24);text('Version i korrigjuar. Versionet e mëparshme ruhen të pandryshuara.',left,doc.y,width,7.5,false,muted);}
  const range=doc.bufferedPageRange();if(range.count>200)throw new Error('Dokumenti ka tepër faqe.');
  for(let i=range.start;i<range.start+range.count;i++){
   doc.switchToPage(i);const oldBottom=doc.page.margins.bottom;doc.page.margins.bottom=0;
   doc.moveTo(left,778).lineTo(right,778).strokeColor(line).stroke();
   text('Vërteton pagesën e pranuar; nuk zëvendëson faturën tatimore.',left,787,437,7,false,muted);
   text(`Ju lutem referoni nr. ${snapshot.receiptNumber} në komunikimin për këtë pagesë.`,left,801,437,7,false,muted);
   text(`${i-range.start+1} / ${range.count}`,490,790,67,8,true,green,'right');doc.page.margins.bottom=oldBottom;
  }
  doc.end();return await completed;
 }catch(error){doc.destroy(error instanceof Error?error:new Error('Gjenerimi dështoi'));await completed.catch(()=>{});throw new Error('Gjenerimi i PDF-së së dëftesës dështoi.');}
}
