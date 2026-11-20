import {randomUUID} from 'node:crypto';
import type {Connection} from 'mysql2/promise';
import {createClient} from '@/features/clients/service';
import {createProject,getProject} from '@/features/projects/service';
import {createReference} from '@/features/references/service';
import {createExpense} from '@/features/expenses/service';
import {confirmPaymentWithReceipt} from '@/features/receipts/service';
import {isDemoConnection} from './connections';

export async function seedDemo(c:Connection,token:string){
 if(!isDemoConnection(c))throw new Error('Demo connection required');
 const date=new Date().toISOString().slice(0,10);
 const category=await createReference(c,token,'categories',{name:'Materiale ndërtimi — DEMO'});
 await createReference(c,token,'persons',{name:'Furnitori shembull — DEMO'});
 await createReference(c,token,'vehicles',{description:'Kamioni provues',identifier:'DEMO-001'});
 for(const [name,clientName,total,paid,expense] of [
  ['Rezidenca e Gjelbër','Investitori shembull A','120000.00','24000.00','8500.00'],
  ['Qendra e Biznesit','Investitori shembull B','80000.00','16000.00','4200.00'],
  ['Vila Panorama','Klienti shembull C','50000.00','10000.00','2750.00'],
 ]){
  const client=await createClient(c,token,{type:'business',name:`${clientName} — DEMO`,city:'Prishtinë',addressLine1:'Adresa fiktive e demonstrimit'});
  const project=await createProject(c,token,{project:{name:`${name} — DEMO`,clientId:client.id,clientVersion:client.version,status:'active',location:'Lokacion fiktiv, Prishtinë',startDate:date},contract:{totalValue:total,phases:[{name:'Punimet e kontraktuara',value:total,sortOrder:0}]}});
  const detail=await getProject(c,token,project.id);
  await confirmPaymentWithReceipt(c,token,{idempotencyKey:randomUUID(),payment:{projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract!.id,contractVersion:detail.contract!.version,amount:paid,transactionDate:date,method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount:paid}]}});
  const fresh=await getProject(c,token,project.id);
  await createExpense(c,token,{amount:expense,transactionDate:date,description:'Materiale dhe punime provuese — DEMO',category:{id:category.id,version:category.version},project:{id:project.id,version:fresh.project.version}});
 }
 await createExpense(c,token,{amount:'650.00',transactionDate:date,description:'Shpenzim i kompanisë — DEMO',category:{id:category.id,version:category.version}});
}
