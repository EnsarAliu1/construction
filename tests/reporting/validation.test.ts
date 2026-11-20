import assert from "node:assert/strict";
import test from "node:test";
import {mkdir,writeFile} from "node:fs/promises";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {reportFilter,companyExportInput} from "../../src/features/reporting/validation";
import {finances,financeReports} from "../../src/features/reporting/finance";
import {sumMoney,operationalTotals} from "../../src/features/reporting/money";
import {portable,csvCell} from "../../src/features/reporting/export";
import {companyPdf,companyXlsx} from "../../src/features/reporting/documents";
import type {Snapshot} from "../../src/features/reporting/snapshot";
const id=(n:number)=>`${String(n).padStart(8,"0")}-1111-4111-8111-111111111111`;
test("snapshot grouping keeps filtered breakdowns separate from all-date project balances",()=>{
 const s=sample();
 s.data.projects.push({id:id(20),clientId:id(1),name:"Archived synthetic project",status:"completed",deletedAt:"2026-01-01"});
 s.data.expense_categories.push({id:id(21),name:"Other category"});
 s.data.expenses.push({id:id(22),projectId:id(20),categoryId:id(21),amount:"5.67",transactionDate:"2025-01-01",status:"recorded"});
 s.data.expenses.push({id:id(23),projectId:id(20),categoryId:id(21),amount:"8.00",transactionDate:"2025-01-01",status:"cancelled"});
 const r=finances(s,reportFilter({from:"2025-01-01",categoryId:id(21)}));
 assert.equal(r.totals.income,"0.00");assert.equal(r.totals.expenses,"5.67");assert.equal(r.totals.companyExpenses,"0.00");
 assert.equal(r.projects[0].income,"9007199254740993.01");assert.equal(r.projects[0].expenses,"0.01");
 assert.equal(r.projects[1].expenses,"5.67");assert.equal(r.activeProjects,1);
 assert.deepEqual(r.breakdowns,[{id:id(20),name:"Archived synthetic project",income:"0.00",expenses:"5.67"}]);
 assert.deepEqual(r.categories,[{id:id(21),name:"Other category",amount:"5.67"}]);
});
function sample():Snapshot{return {generatedAt:"2026-10-27T12:00:00.000Z",counts:{},data:{clients:[{id:id(1),name:"Çlirim Ëndrra"}],projects:[{id:id(2),clientId:id(1),name:"=2+3",status:"active",deletedAt:null}],contracts:[{id:id(3),projectId:id(2),status:"active",totalValue:"99999999999999999.99"}],contract_phases:[{id:id(4),contractId:id(3),name:"Themelet",value:"99999999999999999.99",deletedAt:null}],payments:[{id:id(5),projectId:id(2),amount:"9007199254740993.01",method:"cash",transactionDate:"2024-02-29",status:"received"}],payment_allocations:[{id:id(6),paymentId:id(5),phaseId:id(4),amount:"9007199254740993.01",deletedAt:null}],expense_categories:[{id:id(7),name:"Çati"}],expenses:[{id:id(8),projectId:id(2),categoryId:id(7),amount:"0.01",transactionDate:"2024-02-29",description:"=HYPERLINK(\"https://example.invalid\")",status:"recorded"},{id:id(9),projectId:null,categoryId:id(7),amount:"0.02",transactionDate:"2024-02-29",description:"Company-wide TEST",status:"recorded"}]}};}
test("related reports retain exact balances across filters without mutating or caching a snapshot",()=>{
 const s=sample(),before=structuredClone(s),filters=[reportFilter(),reportFilter({from:"2024-03-01"}),reportFilter({method:"bank"}),reportFilter({categoryId:id(7)})];
 const reports=financeReports(s,filters);
 assert.deepEqual(reports,filters.map(filter=>finances(s,filter)));assert.deepEqual(s,before);
 assert.equal(reports[0].totals.income,"9007199254740993.01");assert.equal(reports[1].totals.expenses,"0.00");assert.equal(reports[2].totals.income,"0.00");
 for(const report of reports)assert.equal(report.projects[0].income,"9007199254740993.01");
 s.data.expenses[0].status="cancelled";
 assert.equal(financeReports(s,filters)[0].totals.expenses,"0.02");assert.equal(reports[0].totals.expenses,"0.03");
 const other=sample();other.data.projects[0].name="Different snapshot";
 assert.equal(financeReports(other,filters)[0].projects[0].name,"Different snapshot");assert.equal(reports[0].projects[0].name,"=2+3");
});
test("related reports reject corrupt phase allocations even when all requested periods exclude the payment",()=>{
 for(const mutate of [(s:Snapshot)=>s.data.payment_allocations[0].amount="0.01",(s:Snapshot)=>s.data.contract_phases[0].value="0.01",(s:Snapshot)=>s.data.contract_phases.splice(0)]){
  const s=sample();mutate(s);
  assert.throws(()=>financeReports(s,[reportFilter({from:"2026-01-01"}),reportFilter({method:"bank"})]),{code:"INCONSISTENT"});
 }
});
test("report filters use strict real calendar dates, scoped methods/categories and no project export",()=>{assert.equal(reportFilter({from:"2024-02-29",to:"2024-03-01",method:"bank"}).method,"bank");for(const input of [{from:"2023-02-29"},{from:"2025-01-02",to:"2025-01-01"},{from:[]},{method:["cash"]},{categoryId:"../"},{projectId:id(2)},{format:"pdf"}])assert.throws(()=>reportFilter(input));for(const value of [{format:"csv"},{format:"pdf",projectId:id(2)},{format:"xlsx",filters:{projectId:id(2)}}])assert.throws(()=>companyExportInput(value));});
test("EUR sums/difference exceed Number and individual DECIMAL bounds without rounding",()=>{assert.equal(sumMoney(["99999999999999999.99","99999999999999999.99"]).toString(),"19999999999999999998");assert.equal(operationalTotals(BigInt(1),BigInt(3)).difference,"-0.02");const r=finances(sample(),reportFilter());assert.equal(r.totals.income,"9007199254740993.01");assert.equal(r.totals.difference,"9007199254740992.98");assert.equal(r.projects[0].expenses,"0.01");assert.equal(r.totals.companyExpenses,"0.02");});
test("empty snapshot gives honest zero totals and received/recorded filters exclude cancelled rows",()=>{const s=sample();for(const key of Object.keys(s.data))s.data[key]=[];assert.equal(finances(s,reportFilter()).totals.income,"0.00");const current=sample();current.data.payments.push({...current.data.payments[0],id:id(10),status:"cancelled"});current.data.expenses.push({...current.data.expenses[0],id:id(11),status:"cancelled"});assert.equal(finances(current,reportFilter()).totals.expenses,"0.03");assert.equal(finances(current,reportFilter({from:"2024-03-01"})).income.length,0);assert.equal(finances(current,reportFilter({method:"bank"})).totals.income,"0.00");});
test("inconsistent allocations/phase balances fail rather than fabricate verified totals",()=>{for(const mutate of [(s:Snapshot)=>s.data.payment_allocations[0].amount="0.01",(s:Snapshot)=>s.data.contract_phases[0].value="0.01",(s:Snapshot)=>s.data.contracts[0].projectId=id(99),(s:Snapshot)=>s.data.payment_allocations[0].deletedAt="2026-01-01"]){const s=sample();mutate(s);assert.throws(()=>finances(s,reportFilter()));}});
test("portable JSON strips infrastructure keys recursively and CSV escapes executable prefixes",()=>{const value=portable({id:id(1),legacy:[{totp_seed:"never-export",key_id:"never-export",recovery_codes:["never-export"],pendingRecoveryHashes:["never-export"],verifier:"never-export",cipher:"never-export",challengeId:"never-export",mfa:{value:"never-export"},receiptNumber:"DEV-0001"}],storageReference:"private-path",snapshot:{storageReference:"path",name:"=2+3",amount:"9007199254740993.01"},passwordHash:"never-export",token_hash:"never-export"}) as Record<string,unknown>;assert.equal(JSON.stringify(value).includes("never-export"),false);assert.equal(JSON.stringify(value).includes("private-path"),false);assert(JSON.stringify(value).includes("DEV-0001"));for(const text of ["=2+3","+SUM(1)","-cmd","@SUM(1)","\t=cmd","  =cmd"])assert.ok(csvCell(text).startsWith('"\''));assert.equal(csvCell('Çati "TEST"'),'"Çati ""TEST"""');});
test("actual XLSX opens, keeps exact monetary TEXT, safe names and matching summary/detail rows",async()=>{const r=finances(sample(),reportFilter()),bytes=await companyXlsx(r),book=new ExcelJS.Workbook();await book.xlsx.load(bytes as never);assert.equal(book.worksheets.length,7);assert.equal(book.getWorksheet("Përmbledhja")!.getCell("B3").value,r.totals.income);assert.equal(book.getWorksheet("Pagesat")!.getCell("F2").value,"9007199254740993.01");assert.equal(book.getWorksheet("Pagesat")!.getCell("C2").value,"=2+3");assert.equal(book.getWorksheet("Shpenzimet")!.getCell("E2").type,ExcelJS.ValueType.String);const zip=await JSZip.loadAsync(bytes);for(const path of Object.keys(zip.files).filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)))assert.doesNotMatch(await zip.file(path)!.async("string"),/<f[ >]/);await mkdir("artifacts/wp10/qa",{recursive:true});await writeFile("artifacts/wp10/qa/company-report.xlsx",bytes);});
test("actual company PDF is A4, renders real totals and long Albanian content with pagination",async()=>{const r=finances(sample(),reportFilter());await mkdir("artifacts/wp10/qa",{recursive:true});const normal=await companyPdf(r);assert.equal(normal.subarray(0,5).toString(),"%PDF-");assert.match(normal.toString("latin1"),/\/MediaBox \[0 0 595\.28 841\.89\]/);await writeFile("artifacts/wp10/qa/company-report.pdf",normal);r.outgoing[0].description="Përfundime çatie, ndërtim dhe mirëmbajtje. ".repeat(200);const long=await companyPdf(r);assert.ok((long.toString("latin1").match(/\/Type \/Page\b/g)??[]).length>1);await writeFile("artifacts/wp10/qa/company-report-long.pdf",long);});
