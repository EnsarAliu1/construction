import {cents,decimal} from "@/features/projects/money";
export const financialStates={income:"received",expense:"recorded"} as const;
export function operationalTotals(income:bigint,expenses:bigint){return {income:decimal(income),expenses:decimal(expenses),difference:decimal(income-expenses)};}
export const sumMoney=(values:string[])=>values.reduce((n,value)=>n+cents(value),BigInt(0));
