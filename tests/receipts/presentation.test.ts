import assert from 'node:assert/strict';
import test from 'node:test';
import {receiptCompany} from '../../src/features/receipts/company-profile';
import {receiptTax,receiptTaxLines} from '../../src/features/receipts/tax';
import {cents,decimal} from '../../src/features/projects/money';

test('document VAT is explicit and company data/logo paths are bounded without invented fiscal details',()=>{
 const plain=receiptCompany({RECEIPT_COMPANY_NAME:'Kompania provuese'});
 assert.equal(plain.vatStatus,'unspecified');assert.equal(plain.vatRate,0);assert.equal(plain.nui,'');
 const registered=receiptCompany({RECEIPT_COMPANY_NAME:'Provë',RECEIPT_VAT_STATUS:'registered',RECEIPT_VAT_NUMBER:'330000001',RECEIPT_VAT_RATE:'18'});
 assert.equal(registered.vatRate,18);
 for(const env of [{RECEIPT_VAT_STATUS:'registered'},{RECEIPT_VAT_STATUS:'registered',RECEIPT_VAT_NUMBER:'330000001',RECEIPT_VAT_RATE:'0'},{RECEIPT_VAT_RATE:'18'},{RECEIPT_LOGO_FILE:'../../.env.local'},{RECEIPT_LOGO_FILE:'https://attacker.invalid/a.png'},{RECEIPT_COMPANY_NAME:'name\nInjected'}])assert.throws(()=>receiptCompany(env));
});
test('VAT included and added use exact cents for 18%, 8%, 0%, tiny and large amounts',()=>{
 assert.deepEqual(receiptTax('118.00',18),{net:'100.00',vat:'18.00',gross:'118.00',rate:18});
 assert.deepEqual(receiptTax('100.00',18,'added'),{net:'100.00',vat:'18.00',gross:'118.00',rate:18});
 assert.deepEqual(receiptTax('108.00',8),{net:'100.00',vat:'8.00',gross:'108.00',rate:8});
 assert.deepEqual(receiptTax('100.00',0),{net:'100.00',vat:'0.00',gross:'100.00',rate:0});
 for(const value of ['0.01','0.03','99999999999999999.99'])for(const rate of [0,8,18] as const){const t=receiptTax(value,rate);assert.equal(cents(t.net)+cents(t.vat),cents(value));}
});
test('line VAT distributes rounding cents deterministically and reconciles to every payment total',()=>{
 for(const amounts of [['0.03','0.03'],['100.00','234.56'],Array.from({length:100},()=> '0.01'),['99999999999999999.99','0.01']])for(const rate of [0,8,18] as const){
  const rows=receiptTaxLines(amounts,rate),gross=amounts.reduce((n,v)=>n+cents(v),BigInt(0)),total=receiptTax(decimal(gross),rate);
  assert.equal(rows.reduce((n,row)=>n+cents(row.net),BigInt(0)),cents(total.net));assert.equal(rows.reduce((n,row)=>n+cents(row.vat),BigInt(0)),cents(total.vat));
  rows.forEach((row,i)=>assert.equal(cents(row.net)+cents(row.vat),cents(amounts[i])));assert.deepEqual(rows,receiptTaxLines(amounts,rate));
 }
});
