import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMonth,dashboardOverview,displayEuro} from '../../src/features/dashboard/overview';
import type {Snapshot} from '../../src/features/reporting/snapshot';

function sample():Snapshot{return {generatedAt:'2026-10-15T12:00:00Z',counts:{},data:{clients:[{id:'client',name:'Provë',deletedAt:null}],projects:[{id:'site',clientId:'client',name:'Punishte provuese',status:'active',deletedAt:null}],contracts:[{id:'contract',projectId:'site',status:'active',totalValue:'1000.00'}],contract_phases:[{id:'phase',contractId:'contract',name:'Faza',value:'1000.00',deletedAt:null}],payment_allocations:[],payments:[],expenses:[],expense_categories:[{id:'category',name:'Materiale'}]}};}
test('dashboard uses the entire calendar month, including leap years and business-zone year rollover',()=>{
 assert.deepEqual([calendarMonth(new Date('2026-10-15T12:00:00Z')).from,calendarMonth(new Date('2026-10-15T12:00:00Z')).to],['2026-10-01','2026-10-31']);
 assert.equal(calendarMonth(new Date('2024-02-15T12:00:00Z')).to,'2024-02-29');
 assert.equal(calendarMonth(new Date('2025-02-15T12:00:00Z')).to,'2025-02-28');
 const january=calendarMonth(new Date('2026-12-31T23:30:00Z'));assert.equal(january.from,'2027-01-01');assert.equal(january.to,'2027-01-31');
});
test('monthly values use transaction dates, exclude cancellations and preserve all-time/contract totals separately',()=>{
 const s=sample();
 for(const [i,date] of ['2026-09-30','2026-10-01','2026-10-15','2026-10-31','2026-11-01'].entries()){
  s.data.payments.push({id:`p${i}`,projectId:'site',status:'received',amount:'10.00',transactionDate:date,method:'bank'});
  s.data.payment_allocations.push({id:`a${i}`,paymentId:`p${i}`,phaseId:'phase',amount:'10.00',deletedAt:null});
  s.data.expenses.push({id:`e${i}`,projectId:null,categoryId:'category',status:'recorded',amount:'1.25',transactionDate:date});
 }
 s.data.payments.push({id:'cancelled',projectId:'site',status:'cancelled',amount:'99.00',transactionDate:'2026-10-16'});
 s.data.expenses.push({id:'cancelled-expense',projectId:null,categoryId:'category',status:'cancelled',amount:'99.00',transactionDate:'2026-10-16'});
 const d=dashboardOverview(s,new Date('2026-10-15T12:00:00Z'));
 assert.equal(d.monthly.totals.income,'30.00');assert.equal(d.monthly.totals.expenses,'3.75');assert.equal(d.monthly.totals.difference,'26.25');
 assert.equal(d.all.totals.income,'50.00');assert.equal(d.all.totals.expenses,'6.25');assert.equal(d.all.totals.contractValue,'1000.00');assert.equal(d.all.totals.outstanding,'950.00');
 assert(d.recentPayments.some(p=>p.cancelled));assert(d.recentPayments.every(p=>p.date.startsWith('2026-10-')));assert.equal(d.counts.active,1);assert.equal(d.counts.clients,1);
});
test('empty months show zero without carrying previous-month income into the current month',()=>{
 const s=sample();s.data.expenses.push({id:'old',categoryId:'category',projectId:null,status:'recorded',amount:'15.00',transactionDate:'2026-09-30'});
 const d=dashboardOverview(s,new Date('2026-10-01T12:00:00Z'));assert.equal(d.monthly.totals.expenses,'0.00');assert.equal(d.all.totals.difference,'-15.00');assert.equal(d.recentExpenses.length,0);
});
test('dashboard currency display preserves cents and amounts beyond Number precision',()=>{
 assert.equal(displayEuro('9007199254740993.01'),'9.007.199.254.740.993,01 €');assert.equal(displayEuro('-12.50'),'-12,50 €');assert.equal(displayEuro('0.00'),'0 €');assert.throws(()=>displayEuro('1e3'));
});
