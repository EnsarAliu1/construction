import {cents as euroCents,decimal as centsToEuro} from "@/features/projects/money";
import {ReportingError,type ReportFilter} from "./validation";
import type {DataRow,Snapshot} from "./snapshot";
import {financialStates,operationalTotals} from "./money";
export const received=(r:DataRow)=>r.status===financialStates.income;
export const recorded=(r:DataRow)=>r.status===financialStates.expense;
const sum=(rows:DataRow[],field="amount")=>rows.reduce((n,r)=>n+euroCents(String(r[field])),BigInt(0));
const invalid=()=>new ReportingError("INCONSISTENT","Financial relationships or phase balances require operator review. This summary has not been verified.",409);
export function finances(s:Snapshot,filter:ReportFilter){
 const d=s.data,projectById=new Map(d.projects.map(r=>[r.id,r])),clientById=new Map(d.clients.map(r=>[r.id,r])),phaseById=new Map(d.contract_phases.map(r=>[r.id,r])),contractById=new Map(d.contracts.map(r=>[r.id,r]));
 const allIncome=d.payments.filter(received),allExpenses=d.expenses.filter(recorded),paymentById=new Map(allIncome.map(p=>[p.id,p])),activeAlloc=d.payment_allocations.filter(r=>r.deletedAt===null&&paymentById.has(r.paymentId));
 const allocated=new Map<unknown,bigint>(),paid=new Map<unknown,bigint>();
 for(const a of activeAlloc){const p=paymentById.get(a.paymentId)!,phase=phaseById.get(a.phaseId),contract=phase&&contractById.get(phase.contractId);if(!phase||phase.deletedAt||!contract||contract.projectId!==p.projectId||contract.status!=="active")throw invalid();const amount=euroCents(String(a.amount));if(amount<=BigInt(0))throw invalid();allocated.set(p.id,(allocated.get(p.id)??BigInt(0))+amount);paid.set(a.phaseId,(paid.get(a.phaseId)??BigInt(0))+amount);}
 for(const p of allIncome)if(!projectById.has(p.projectId)||allocated.get(p.id)!==euroCents(String(p.amount)))throw invalid();
 const inDate=(r:DataRow)=>(!filter.from||String(r.transactionDate)>=filter.from)&&(!filter.to||String(r.transactionDate)<=filter.to);
 const label=(r:DataRow):DataRow=>{const p=projectById.get(r.projectId),client=p&&clientById.get(p.clientId);if(r.projectId&&(!p||!client))throw invalid();return {...r,projectName:p?.name??"Company-wide",clientName:client?.name??""};};
 const ordered=(a:DataRow,b:DataRow)=>String(b.transactionDate).localeCompare(String(a.transactionDate))||String(b.id).localeCompare(String(a.id));
 const income=allIncome.filter(r=>inDate(r)&&(filter.method==="all"||r.method===filter.method)).map(label).sort(ordered);
 const outgoing=allExpenses.filter(r=>inDate(r)&&(!filter.categoryId||r.categoryId===filter.categoryId)).map((r):DataRow=>{const category=d.expense_categories.find(c=>c.id===r.categoryId);if(!category)throw invalid();return {...label(r),categoryName:category.name};}).sort(ordered);
 const projects=d.projects.map(project=>{
  const contract=d.contracts.find(c=>c.projectId===project.id),phases=d.contract_phases.filter(p=>p.contractId===contract?.id&&p.deletedAt===null);
  if(contract?.status==="active"&&sum(phases,"value")!==euroCents(String(contract.totalValue)))throw invalid();
  const values=phases.map(p=>{const value=euroCents(String(p.value)),used=paid.get(p.id)??BigInt(0);if(used>value)throw invalid();return {id:String(p.id),name:String(p.name),value:centsToEuro(value),paid:centsToEuro(used),remaining:centsToEuro(value-used)};});
  const actualIncome=sum(allIncome.filter(p=>p.projectId===project.id)),cost=sum(allExpenses.filter(e=>e.projectId===project.id)),value=contract?.status==="active"?euroCents(String(contract.totalValue)):BigInt(0),allocatedPaid=values.reduce((n,p)=>n+euroCents(p.paid),BigInt(0));
  return {id:String(project.id),name:String(project.name),status:String(project.status),deletedAt:project.deletedAt,contractValue:centsToEuro(value),...operationalTotals(actualIncome,cost),outstanding:centsToEuro(value-(contract?.status==="active"?allocatedPaid:BigInt(0))),phases:values};
 });
 const current=projects.filter(p=>p.deletedAt===null),contractTotal=current.reduce((n,p)=>n+euroCents(p.contractValue),BigInt(0)),outstanding=current.reduce((n,p)=>n+euroCents(p.outstanding),BigInt(0));
 const totalIncome=sum(income),totalExpenses=sum(outgoing),breakdowns=projects.map(p=>({id:p.id,name:p.name,income:centsToEuro(sum(income.filter(i=>i.projectId===p.id))),expenses:centsToEuro(sum(outgoing.filter(e=>e.projectId===p.id)))})).filter(p=>p.income!=="0.00"||p.expenses!=="0.00");
 const categories=d.expense_categories.map(c=>({id:String(c.id),name:String(c.name),amount:centsToEuro(sum(outgoing.filter(e=>e.categoryId===c.id)))})).filter(c=>c.amount!=="0.00");
 return {generatedAt:s.generatedAt,filter,totals:{...operationalTotals(totalIncome,totalExpenses),companyExpenses:centsToEuro(sum(outgoing.filter(e=>e.projectId===null))),contractValue:centsToEuro(contractTotal),outstanding:centsToEuro(outstanding)},activeProjects:current.filter(p=>p.status==="active").length,statusCounts:["active","suspended","completed"].map(status=>({status,count:current.filter(p=>p.status===status).length})),income,outgoing,projects,breakdowns,categories,categoryOptions:d.expense_categories.map(c=>({id:String(c.id),name:String(c.name)})),methods:["cash","bank"].map(method=>({method,amount:centsToEuro(sum(income.filter(p=>p.method===method)))}))};
}
export type FinanceReport=ReturnType<typeof finances>;
