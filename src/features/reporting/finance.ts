import {cents as euroCents,decimal as centsToEuro} from "@/features/projects/money";
import {ReportingError,type ReportFilter} from "./validation";
import type {DataRow,Snapshot} from "./snapshot";
import {financialStates,operationalTotals} from "./money";
export const received=(r:DataRow)=>r.status===financialStates.income;
export const recorded=(r:DataRow)=>r.status===financialStates.expense;
const sum=(rows:DataRow[],field="amount")=>rows.reduce((n,r)=>n+euroCents(String(r[field])),BigInt(0));
const invalid=()=>new ReportingError("INCONSISTENT","Lidhjet financiare ose bilancet e fazave kërkojnë kontroll nga operatori. Kjo përmbledhje nuk është verifikuar.",409);
function prepareFinances(s:Snapshot){
 const d=s.data,projectById=new Map(d.projects.map(r=>[r.id,r])),clientById=new Map(d.clients.map(r=>[r.id,r])),phaseById=new Map(d.contract_phases.map(r=>[r.id,r])),contractById=new Map(d.contracts.map(r=>[r.id,r]));
 // Snapshot-local indexes only: never shared caches or authoritative capacity previews.
 const categoryById=new Map(d.expense_categories.map(r=>[r.id,r])),contractByProject=new Map<unknown,DataRow>();
 for(const contract of d.contracts)if(!contractByProject.has(contract.projectId))contractByProject.set(contract.projectId,contract);
 const phasesByContract=new Map<unknown,DataRow[]>();
 for(const phase of d.contract_phases)if(phase.deletedAt===null){const phases=phasesByContract.get(phase.contractId)??[];phases.push(phase);phasesByContract.set(phase.contractId,phases);}
 const totalsBy=(rows:DataRow[],key:string)=>{const result=new Map<unknown,bigint>();for(const row of rows)result.set(row[key],(result.get(row[key])??BigInt(0))+euroCents(String(row.amount)));return result;};
 const allIncome=d.payments.filter(received),allExpenses=d.expenses.filter(recorded),paymentById=new Map(allIncome.map(p=>[p.id,p])),activeAlloc=d.payment_allocations.filter(r=>r.deletedAt===null&&paymentById.has(r.paymentId));
 const allocated=new Map<unknown,bigint>(),paid=new Map<unknown,bigint>();
 for(const a of activeAlloc){const p=paymentById.get(a.paymentId)!,phase=phaseById.get(a.phaseId),contract=phase&&contractById.get(phase.contractId);if(!phase||phase.deletedAt||!contract||contract.projectId!==p.projectId||contract.status!=="active")throw invalid();const amount=euroCents(String(a.amount));if(amount<=BigInt(0))throw invalid();allocated.set(p.id,(allocated.get(p.id)??BigInt(0))+amount);paid.set(a.phaseId,(paid.get(a.phaseId)??BigInt(0))+amount);}
 for(const p of allIncome)if(!projectById.has(p.projectId)||allocated.get(p.id)!==euroCents(String(p.amount)))throw invalid();
 const allIncomeByProject=totalsBy(allIncome,"projectId"),allExpensesByProject=totalsBy(allExpenses,"projectId");
 const projects=d.projects.map(project=>{
  const contract=contractByProject.get(project.id),phases=phasesByContract.get(contract?.id)??[];
  if(contract?.status==="active"&&sum(phases,"value")!==euroCents(String(contract.totalValue)))throw invalid();
  const values=phases.map(p=>{const value=euroCents(String(p.value)),used=paid.get(p.id)??BigInt(0);if(used>value)throw invalid();return {id:String(p.id),name:String(p.name),value:centsToEuro(value),paid:centsToEuro(used),remaining:centsToEuro(value-used)};});
  const actualIncome=(allIncomeByProject.get(project.id)??BigInt(0)),cost=(allExpensesByProject.get(project.id)??BigInt(0)),value=contract?.status==="active"?euroCents(String(contract.totalValue)):BigInt(0),allocatedPaid=values.reduce((n,p)=>n+euroCents(p.paid),BigInt(0));
  return {id:String(project.id),name:String(project.name),status:String(project.status),deletedAt:project.deletedAt,contractValue:centsToEuro(value),...operationalTotals(actualIncome,cost),outstanding:centsToEuro(value-(contract?.status==="active"?allocatedPaid:BigInt(0))),phases:values};
 });
 const current=projects.filter(p=>p.deletedAt===null),contractTotal=current.reduce((n,p)=>n+euroCents(p.contractValue),BigInt(0)),outstanding=current.reduce((n,p)=>n+euroCents(p.outstanding),BigInt(0));
 // Each projection shares only this immutable snapshot preparation, never another request.
 return (filter:ReportFilter)=>{
 const inDate=(r:DataRow)=>(!filter.from||String(r.transactionDate)>=filter.from)&&(!filter.to||String(r.transactionDate)<=filter.to);
 const label=(r:DataRow):DataRow=>{const p=projectById.get(r.projectId),client=p&&clientById.get(p.clientId);if(r.projectId&&(!p||!client))throw invalid();return {...r,projectName:p?.name??"Për kompaninë",clientName:client?.name??""};};
 const ordered=(a:DataRow,b:DataRow)=>String(b.transactionDate).localeCompare(String(a.transactionDate))||String(b.id).localeCompare(String(a.id));
 const income=allIncome.filter(r=>inDate(r)&&(filter.method==="all"||r.method===filter.method)).map(label).sort(ordered);
 const outgoing=allExpenses.filter(r=>inDate(r)&&(!filter.categoryId||r.categoryId===filter.categoryId)).map((r):DataRow=>{const category=categoryById.get(r.categoryId);if(!category)throw invalid();return {...label(r),categoryName:category.name};}).sort(ordered);
 const incomeByProject=totalsBy(income,"projectId"),expensesByProject=totalsBy(outgoing,"projectId"),expensesByCategory=totalsBy(outgoing,"categoryId");
 const totalIncome=sum(income),totalExpenses=sum(outgoing),breakdowns=projects.map(p=>({id:p.id,name:p.name,income:centsToEuro(incomeByProject.get(p.id)??BigInt(0)),expenses:centsToEuro(expensesByProject.get(p.id)??BigInt(0))})).filter(p=>p.income!=="0.00"||p.expenses!=="0.00");
 const categories=d.expense_categories.map(c=>({id:String(c.id),name:String(c.name),amount:centsToEuro(expensesByCategory.get(c.id)??BigInt(0))})).filter(c=>c.amount!=="0.00");
 return {generatedAt:s.generatedAt,filter,totals:{...operationalTotals(totalIncome,totalExpenses),companyExpenses:centsToEuro(sum(outgoing.filter(e=>e.projectId===null))),contractValue:centsToEuro(contractTotal),outstanding:centsToEuro(outstanding)},activeProjects:current.filter(p=>p.status==="active").length,statusCounts:["active","suspended","completed"].map(status=>({status,count:current.filter(p=>p.status===status).length})),income,outgoing,projects,breakdowns,categories,categoryOptions:d.expense_categories.map(c=>({id:String(c.id),name:String(c.name)})),methods:["cash","bank"].map(method=>({method,amount:centsToEuro(sum(income.filter(p=>p.method===method)))}))};
}
}
/** Build related reports without repeating snapshot integrity checks and project balances. */
export function financeReports(s:Snapshot,filters:readonly ReportFilter[]){
 const project=prepareFinances(s);
 return filters.map(filter=>project(filter));
}
export function finances(s:Snapshot,filter:ReportFilter){return prepareFinances(s)(filter);}
export type FinanceReport=ReturnType<typeof finances>;
