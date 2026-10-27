import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { parseExpense, parseExpenseQuery, parseCorrection, parseCancellation, ExpenseError } from "../../src/features/expenses/validation";
const valid = () => ({amount:"10.25",transactionDate:"2024-02-29",description:" Synthetic expense ",category:{id:randomUUID(),version:1}});
test("expenses accept exact positive DECIMAL bounds and normalize plain description",()=>{
  assert.equal(parseExpense({...valid(),amount:"99999999999999999.99"}).amount,"99999999999999999.99");
  assert.equal(parseExpense({...valid(),amount:"0001.1"}).amount,"1.10");assert.equal(parseExpense(valid()).description,"Synthetic expense");
  for(const amount of ["0","0.00","-1.00","1.001","1.","1e2","NaN","Infinity","100000000000000000.00","1,00",1,null])assert.throws(()=>parseExpense({...valid(),amount}),ExpenseError);
});
test("calendar dates reject normalized impossible dates and use DATE bounds",()=>{
  for(const transactionDate of ["2023-02-29","2024-02-30","2026-04-31","0999-01-01","10000-01-01","2026-1-01","2026-10-27T00:00:00Z",null])assert.throws(()=>parseExpense({...valid(),transactionDate}),ExpenseError);
  for(const transactionDate of ["1000-01-01","9999-12-31","2000-02-29"])assert.equal(parseExpense({...valid(),transactionDate}).transactionDate,transactionDate);
});
test("strict whitelists, byte bounds, required category and optional versioned selections",()=>{
  for(const field of ["status","createdBy","updatedBy","cancelledBy","id","version","createdAt","clientId","currency","password"])assert.throws(()=>parseExpense({...valid(),[field]:"protected"}),ExpenseError);
  for(const description of [" ","hidden\u0085control","line\nbreak","😀".repeat(20000),null])assert.throws(()=>parseExpense({...valid(),description}),ExpenseError);
  for(const category of [null,{}, {id:randomUUID(),version:0},{id:"not-an-id",version:1},{id:randomUUID(),version:1,status:"active"}])assert.throws(()=>parseExpense({...valid(),category}),ExpenseError);
  const inline=parseExpense({...valid(),category:null,newCategoryName:"  Site   costs  "});assert.equal(inline.newCategoryName,"Site costs");assert.equal(inline.project,null);
  assert.throws(()=>parseExpense({...valid(),newCategoryName:"Both"}),ExpenseError);assert.throws(()=>parseExpense({...valid(),person:{id:randomUUID()}}),ExpenseError);
});
test("correction and cancellation require explicit confirmation, version and cancellation reason",()=>{
  assert.equal(parseCorrection({version:1,confirmation:"correct",expense:valid()}).version,1);
  assert.throws(()=>parseCorrection({version:1,expense:valid()}),ExpenseError);
  assert.throws(()=>parseCorrection({version:1,confirmation:"correct",expense:{...valid(),category:null,newCategoryName:"New"}}),ExpenseError);
  assert.throws(()=>parseCancellation({version:1,confirmation:"cancel",reason:" "}),ExpenseError);
  assert.equal(parseCancellation({version:1,confirmation:"cancel",reason:" Synthetic correction "}).reason,"Synthetic correction");
});
test("bounded query validates dates, identities and literal search without accepting arrays",()=>{
  const query=parseExpenseQuery({projectId:"company",from:"2024-01-01",to:"2024-12-31",q:" %_= ",page:"2",status:"all"});assert.equal(query.projectId,"company");assert.equal(query.page,2);assert.equal(query.q,"%_=");
  for(const input of [{from:"2025-01-01",to:"2024-01-01"},{q:"a".repeat(101)},{q:["x"]},{page:10001},{page:{}},{status:"active"},{categoryId:"wrong"},{unknown:true}])assert.throws(()=>parseExpenseQuery(input),ExpenseError);
});
