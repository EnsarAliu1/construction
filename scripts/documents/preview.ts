/** Synthetic samples from the actual app generators. Never reads a business database. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ExcelJS from 'exceljs';
import {chromium} from '@playwright/test';
import {finances} from '../../src/features/reporting/finance';
import {companyXlsx} from '../../src/features/reporting/documents';
import {reportFilter} from '../../src/features/reporting/validation';
import type {Snapshot} from '../../src/features/reporting/snapshot';
import {renderReceiptPdf} from '../../src/features/receipts/pdf';
import {receiptCompany} from '../../src/features/receipts/company-profile';
import {safeHistorySnapshot} from '../../src/server/db/history-snapshot';

const output='artifacts/documents';
async function main(){
 await mkdir(output,{recursive:true});
 const brand={RECEIPT_COMPANY_NAME:'Kompania Shembull SH.P.K.',RECEIPT_COMPANY_ADDRESS:'Rruga Shembull, nr. 12',RECEIPT_COMPANY_CITY:'Prishtinë, Kosovë',RECEIPT_COMPANY_NUI:'000000000 (SHEMBULL)',RECEIPT_COMPANY_PHONE:'+383 00 000 000',RECEIPT_COMPANY_EMAIL:'financa@example.invalid',RECEIPT_COMPANY_BANK:'Banka Shembull',RECEIPT_COMPANY_IBAN:'XK00 0000 0000 0000 0000 (SHEMBULL)',RECEIPT_VAT_STATUS:'registered',RECEIPT_VAT_NUMBER:'000000000 (SHEMBULL)',RECEIPT_VAT_RATE:'18',RECEIPT_VAT_NOTE:'Shembull për demonstrim. TVSH e përfshirë sipas profilit të kompanisë.'};
 const old=Object.fromEntries(Object.keys(brand).map(key=>[key,process.env[key]]));Object.assign(process.env,brand);
 try{
  const names=['Depoja Veternik','Kompleksi Dardania','Objekti Arbëria'],values=['24850.00','13600.00','5200.00'];
  const snapshot:Snapshot={generatedAt:'2026-11-20T10:30:00.000Z',counts:{},data:{clients:names.map((_,i)=>({id:'client'+i,name:['Klienti Shembull A','Klienti Shembull B','Klienti Shembull C'][i]})),projects:names.map((name,i)=>({id:'project'+i,clientId:'client'+i,name,status:'active',deletedAt:null})),contracts:names.map((_,i)=>({id:'contract'+i,projectId:'project'+i,status:'active',totalValue:'100000.00'})),contract_phases:names.map((_,i)=>({id:'phase'+i,contractId:'contract'+i,name:'Punimet kryesore',value:'100000.00',deletedAt:null})),payments:names.map((_,i)=>({id:'payment'+i,projectId:'project'+i,amount:values[i],transactionDate:'2026-11-12',method:i===2?'cash':'bank',status:'received'})),payment_allocations:names.map((_,i)=>({id:'allocation'+i,paymentId:'payment'+i,phaseId:'phase'+i,amount:values[i],deletedAt:null})),expense_categories:[{id:'material',name:'Materiale ndërtimi'},{id:'work',name:'Punë dhe shërbime'},{id:'fuel',name:'Karburant'}],expenses:[{id:'expense1',projectId:'project0',categoryId:'material',description:'Materiale për fazën e themeleve',amount:'8150.00',transactionDate:'2026-11-05',status:'recorded'},{id:'expense2',projectId:'project1',categoryId:'work',description:'Punime të kontraktuara në objekt',amount:'6200.00',transactionDate:'2026-11-06',status:'recorded'},{id:'expense3',projectId:null,categoryId:'fuel',description:'Karburant për logjistikë',amount:'487.50',transactionDate:'2026-11-08',status:'recorded'}]}};
  const report=finances(snapshot,reportFilter({from:'2026-11-01',to:'2026-11-30'})),bytes=await companyXlsx(report);await writeFile(`${output}/raporti-demo.xlsx`,bytes);
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as never);assert.equal(book.worksheets.length,8);assert.equal(book.getWorksheet('Përmbledhja')!.getCell('B3').value,'43650.00');
  const receipt=safeHistorySnapshot({receiptNumber:'DEV-00000001',documentVersion:1,companyName:brand.RECEIPT_COMPANY_NAME,paymentId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',projectName:'Depoja Veternik',clientName:'Klienti Shembull SH.P.K.',location:'Prishtinë',amount:'1234.56',method:'bank',transactionDate:'2026-11-19',issuedAt:'2026-11-20 10:30:00.000',issuerName:'Përdoruesi Shembull',paymentVersion:1,version:1,allocationsText:'Themelet dhe përgatitja e terrenit: 1000.00 EUR\nPunimet përfundimtare: 234.56 EUR'});
  const buyer={address:'Adresa Shembull, nr. 20',city:'Prishtinë',nui:'000000000 (SHEMBULL)'};
  await writeFile(`${output}/deftesa-demo.pdf`,await renderReceiptPdf(receipt,{company:receiptCompany(),buyer}));
  const long={...receipt,amount:'1200.00',documentVersion:2,allocationsText:Array.from({length:60},(_,i)=>`Faza ${i+1}: Punime ndërtimore me përshkrim të plotë dhe shkronja shqipe ë, ç: 20.00 EUR`).join('\n')};
  await writeFile(`${output}/deftesa-shume-faqe.pdf`,await renderReceiptPdf(long,{company:receiptCompany(),buyer}));
  const large={...receipt,amount:'99999999999999999.99',allocationsText:'Pagesë me vlerë të madhe: 99999999999999999.99 EUR'};
  await writeFile(`${output}/deftesa-vlera-te-medha.pdf`,await renderReceiptPdf(large,{company:receiptCompany(),buyer}));
  await writeFile(`${output}/deftesa-pa-tvsh.pdf`,await renderReceiptPdf(receipt,{company:receiptCompany({...brand,RECEIPT_VAT_STATUS:'not-registered',RECEIPT_VAT_NUMBER:'',RECEIPT_VAT_RATE:''}),buyer}));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:1});
   const escape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
   const column=(address:string)=>{const m=/^([A-Z]+)(\d+)$/.exec(address)!;return {col:[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),row:Number(m[2])};};
   const previews=[];
   for(const [index,s]of book.worksheets.entries()){
    const maxRows=index===0?43:Math.min(s.rowCount,15),maxCols=index===0?12:s.columnCount;
    const merges=(s.model as unknown as {merges:string[]}).merges??[],map=new Map<string,{rows:number;cols:number}>();
    for(const range of merges){const [a,b]=range.split(':'),start=column(a),end=column(b);map.set(a,{rows:end.row-start.row+1,cols:end.col-start.col+1});}
    let html='<div class="sheet"><table><colgroup>';
    for(let c=1;c<=maxCols;c++)html+=`<col style="width:${Math.round((s.getColumn(c).width??12)*7+5)}px">`;html+='</colgroup>';
    for(let r=1;r<=maxRows;r++){
     html+=`<tr style="height:${Math.round((s.getRow(r).height??22)*4/3)}px">`;
     for(let c=1;c<=maxCols;c++){
      const cell=s.getCell(r,c);if(cell.type===ExcelJS.ValueType.Merge)continue;
      const merge=map.get(cell.address),font=cell.font,background=cell.fill?.type==='pattern'?cell.fill.fgColor?.argb:undefined;
      const value=cell.value&&typeof cell.value==='object'&&'text'in cell.value?cell.value.text:cell.value;
      html+=`<td${merge?` colspan="${merge.cols}" rowspan="${merge.rows}"`:''} style="background:#${background?.slice(-6)??'ffffff'};color:#${font?.color?.argb?.slice(-6)??'192d25'};font-size:${font?.size??10}pt;font-weight:${font?.bold?700:400};text-align:${cell.alignment?.horizontal??'left'};padding-left:${(cell.alignment?.indent??0)*8+5}px;${cell.border?.bottom?'border-bottom:1px solid #dce5de;':''}">${escape(value)}</td>`;
     }
     html+='</tr>';
    }
    html+='</table>';
    if(index===0)html+=`<img alt="" style="position:absolute;left:24px;top:36px;width:43px;height:50px;object-fit:contain" src="data:image/png;base64,${(await readFile(receiptCompany().logo)).toString('base64')}">`;
    html+='</div>';
    const document=`<!doctype html><html lang="sq"><meta charset="utf-8"><title>${escape(s.name)}</title><style>body{background:#e9ede8;margin:24px;font-family:Aptos,'Segoe UI',Arial,sans-serif}.sheet{position:relative;display:inline-block;background:white;box-shadow:0 10px 45px #16271c18}table{table-layout:fixed;border-collapse:collapse}td{box-sizing:border-box;vertical-align:middle;padding:5px 8px;overflow-wrap:anywhere;line-height:1.25;white-space:pre-wrap}</style>${html}</html>`;
    const path=resolve(output,`excel-${index}.html`);await writeFile(path,document);await page.goto('file:///'+path.replaceAll('\\','/'));await page.locator('.sheet').screenshot({path:`${output}/excel-${index}.png`});previews.push({sheet:s.name,preview:`excel-${index}.png`,rows:maxRows,columns:maxCols});
   }
   await writeFile(`${output}/verification.json`,JSON.stringify({workbookSheets:book.worksheets.map(s=>s.name),summaryIncome:report.totals.income,summaryExpenses:report.totals.expenses,previews,scope:'Synthetic outputs from actual app generators. Workbook images are read-only HTML reconstructions of saved cell values/styles, not a claim of native Excel/LibreOffice rendering.'},null,2));
  }finally{await browser.close();}
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
 console.log('Generated actual XLSX + four PDF fixtures and read-only previews of every worksheet.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Document preview failed');process.exitCode=1;});
