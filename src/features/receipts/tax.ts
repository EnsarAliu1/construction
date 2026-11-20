import {cents,decimal} from '@/features/projects/money';
export type VatRate=0|8|18;
/** Exact half-up rounding to cents. Display calculations never modify a recorded payment. */
export function receiptTax(amount:string,rate:VatRate,mode:'included'|'added'='included'){
 if(![0,8,18].includes(rate)||!['included','added'].includes(mode))throw new Error('Llogaritje e pavlefshme e TVSH-së.');
 const value=cents(amount),denominator=BigInt(100+rate);
 const net=mode==='included'?(value*BigInt(100)+denominator/BigInt(2))/denominator:value;
 const vat=mode==='included'?value-net:(net*BigInt(rate)+BigInt(50))/BigInt(100);
 return {net:decimal(net),vat:decimal(vat),gross:decimal(net+vat),rate};
}
/** Largest-remainder cent allocation: every displayed row reconciles with the payment total. */
export function receiptTaxLines(amounts:string[],rate:VatRate){
 const denominator=BigInt(100+rate),gross=amounts.map(cents),total=gross.reduce((a,b)=>a+b,BigInt(0));
 const target=cents(receiptTax(decimal(total),rate).net),net=gross.map(value=>value*BigInt(100)/denominator);
 let remaining=target-net.reduce((a,b)=>a+b,BigInt(0));
 const order=gross.map((value,index)=>({index,remainder:value*BigInt(100)%denominator})).sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
 for(const row of order){if(remaining===BigInt(0))break;net[row.index]+=BigInt(1);remaining-=BigInt(1);}
 return gross.map((value,index)=>({net:decimal(net[index]),vat:decimal(value-net[index]),gross:decimal(value),rate}));
}
