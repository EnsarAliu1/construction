import {referenceId,referenceObject,ReferenceError} from "@/features/references/validation";
import {date as calendarDate} from "@/features/expenses/validation";
export class ReportingError extends ReferenceError{}
export type ReportFilter={from:string;to:string;method:"all"|"cash"|"bank";categoryId:string};
export function reportFilter(value:unknown={}):ReportFilter{
 referenceObject(value,["from","to","method","categoryId"]);const v=value as Record<string,unknown>;
 const date=(key:string)=>v[key]===undefined||v[key]===""?"":calendarDate(v[key],key);
 const from=date("from"),to=date("to"),method=v.method??"all",categoryId=v.categoryId??"";
 if(from&&to&&from>to)throw new ReportingError("DATES","Start date must not follow end date.");
 if(!["all","cash","bank"].includes(String(method))||typeof method!=="string")throw new ReportingError("METHOD","Choose cash, bank or all payment methods.");
 if(categoryId!=="")referenceId(categoryId);
 return {from,to,method:method as ReportFilter["method"],categoryId:categoryId as string};
}
export function companyExportInput(value:unknown){referenceObject(value,["format","filters"]);const v=value as Record<string,unknown>;if(v.format!=="pdf"&&v.format!=="xlsx")throw new ReportingError("FORMAT","Choose PDF or XLSX.");return {format:v.format,filters:reportFilter(v.filters??{})};}
export const limitError=()=>new ReportingError("LIMIT","This snapshot exceeds the safe export limit. Refine the company report period, or contact your operator for a larger complete data export. No partial export was produced.",413);
