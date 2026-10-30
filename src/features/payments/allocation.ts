import {cents,decimal,inputMoney} from '@/features/projects/money';
export function allocatePayment(amount:string,phases:{id:string;capacity:string}[]){
 let remaining=cents(inputMoney(amount));if(remaining<=BigInt(0))throw new Error('Shkruani shumën pozitive të pagesës.');
 const capacities=phases.map(p=>({...p,available:cents(p.capacity)}));
 if(capacities.reduce((n,p)=>n+p.available,BigInt(0))<remaining)throw new Error('Shuma e pagesës e tejkalon kapacitetin e mbetur të fazave.');
 const values:Record<string,string>={};for(const p of capacities){const value=p.available<remaining?p.available:remaining;values[p.id]=value>BigInt(0)?decimal(value):'';remaining-=value;}return values;
}
