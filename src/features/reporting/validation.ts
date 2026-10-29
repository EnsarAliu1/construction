import {referenceId,referenceObject,ReferenceError} from "@/features/references/validation";
import {date as calendarDate} from "@/features/expenses/validation";
export class ReportingError extends ReferenceError{}
export type ReportFilter={from:string;to:string;method:"all"|"cash"|"bank";categoryId:string};
export function reportFilter(value:unknown={}):ReportFilter{
 referenceObject(value,["from","to","method","categoryId"]);const v=value as Record<string,unknown>;
 const date=(key:string)=>v[key]===undefined||v[key]===""?"":calendarDate(v[key],key);
 const from=date("from"),to=date("to"),method=v.method??"all",categoryId=v.categoryId??"";
 if(from&&to&&from>to)throw new ReportingError("DATES","Data e fillimit nuk mund të jetë pas datës së përfundimit.");
 if(!["all","cash","bank"].includes(String(method))||typeof method!=="string")throw new ReportingError("METHOD","Zgjidhni para në dorë, transfer bankar ose të gjitha mënyrat e pagesës.");
 if(categoryId!=="")referenceId(categoryId);
 return {from,to,method:method as ReportFilter["method"],categoryId:categoryId as string};
}
export function companyExportInput(value:unknown){referenceObject(value,["format","filters"]);const v=value as Record<string,unknown>;if(v.format!=="pdf"&&v.format!=="xlsx")throw new ReportingError("FORMAT","Zgjidhni PDF ose XLSX.");return {format:v.format,filters:reportFilter(v.filters??{})};}
export const limitError=()=>new ReportingError("LIMIT","Këto të dhëna tejkalojnë kufirin e sigurt të eksportit. Kufizoni periudhën e raportit ose kontaktoni operatorin për eksport më të madh. Nuk u krijua eksport i pjesshëm.",413);
