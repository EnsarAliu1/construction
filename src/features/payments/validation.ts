import { inputMoney, cents, decimal } from "@/features/projects/money";
import { date, text } from "@/features/expenses/validation";
import { ReferenceError, referenceId, referenceObject, referenceVersion } from "@/features/references/validation";
export { ReferenceError as PaymentError };
export const MAX_ALLOCATIONS = 100;
export function positiveMoney(value: unknown, field: string) {
  try {
    if (typeof value !== "string" || !/^\d{1,17}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error();
    const amount = inputMoney(value); if (cents(amount) <= BigInt(0)) throw new Error(); return amount;
  } catch { throw new ReferenceError("AMOUNT", "Shkruani shuma pozitive në EUR me deri në dy shifra dhjetore.", 400, { [field]: "Përdorni 0.01 deri në 99999999999999999.99, pa ndarës." }); }
}
export function parsePayment(value: unknown) {
  const input = referenceObject(value,["projectId","projectVersion","contractId","contractVersion","amount","transactionDate","method","allocations"]);
  if (input.method !== "cash" && input.method !== "bank") throw new ReferenceError("METHOD","Zgjidhni Para në dorë ose Transfer bankar.",400,{method:"Zgjidhni mënyrë të mbështetur pagese."});
  if (!Array.isArray(input.allocations) || input.allocations.length < 1 || input.allocations.length > MAX_ALLOCATIONS) throw new ReferenceError("ALLOCATIONS","Ndajeni të gjithë pagesën në 1 deri në 100 faza.");
  const allocations = input.allocations.map(value => {
    const row = referenceObject(value,["phaseId","phaseVersion","amount"]);
    return { phaseId:referenceId(row.phaseId),phaseVersion:referenceVersion(row.phaseVersion),amount:positiveMoney(row.amount,`allocation-${String(row.phaseId)}`) };
  }).sort((a,b)=>a.phaseId.localeCompare(b.phaseId));
  if (new Set(allocations.map(row=>row.phaseId)).size !== allocations.length) throw new ReferenceError("DUPLICATE_PHASE","Çdo fazë mund të përfshihet vetëm një herë.");
  const amount=positiveMoney(input.amount,"amount"),sum=allocations.reduce((total,row)=>total+cents(row.amount),BigInt(0));
  if(sum!==cents(amount))throw new ReferenceError("EQUALITY",`Shuma e ndarjeve ${decimal(sum)} EUR duhet të jetë e barabartë me shumën e pagesës.`,400,{allocations:"Ndajeni të gjithë shumën saktësisht."});
  return { projectId:referenceId(input.projectId), projectVersion:referenceVersion(input.projectVersion), contractId:referenceId(input.contractId),contractVersion:referenceVersion(input.contractVersion),amount,transactionDate:date(input.transactionDate),method:input.method as "cash"|"bank",allocations };
}
export type PaymentInput=ReturnType<typeof parsePayment>;
export function operationKey(value:unknown){return referenceId(value);}
export function parseConfirmation(value:unknown){const input=referenceObject(value,["idempotencyKey","payment"]);return {key:operationKey(input.idempotencyKey),payment:parsePayment(input.payment)};}
export function parseCorrection(value:unknown){const input=referenceObject(value,["version","confirmation","payment"]);if(input.confirmation!=="correct")throw new ReferenceError("CONFIRMATION","Konfirmoni shprehimisht këtë korrigjim.");return {version:referenceVersion(input.version),payment:parsePayment(input.payment)};}
export function parseCancellation(value:unknown){const input=referenceObject(value,["version","confirmation","reason"]);if(input.confirmation!=="cancel")throw new ReferenceError("CONFIRMATION","Konfirmoni shprehimisht anulimin.");return {version:referenceVersion(input.version),reason:text(input.reason,"reason")};}
export function parsePaymentQuery(value:Record<string,unknown>){
  referenceObject(value,["q","from","to","projectId","method","status","page"]);
  const q=value.q===undefined?"":text(value.q,"q",100,false),from=value.from===undefined||value.from===""?"":date(value.from,"from"),to=value.to===undefined||value.to===""?"":date(value.to,"to");
  if(from&&to&&from>to)throw new ReferenceError("DATE","Data e përfundimit duhet të jetë pas datës së fillimit.");
  const projectId=value.projectId===undefined||value.projectId===""?"":referenceId(value.projectId),method=value.method??"all",status=value.status??"received";
  if(!["cash","bank","all"].includes(String(method))||typeof method!=="string")throw new ReferenceError("METHOD","Filtër i pavlefshëm i mënyrës së pagesës.");
  if(status!=="received"&&status!=="cancelled"&&status!=="all")throw new ReferenceError("STATUS","Filtër i pavlefshëm i gjendjes.");
  if(value.page!==undefined&&typeof value.page!=="string"&&typeof value.page!=="number")throw new ReferenceError("PAGE","Faqe e pavlefshme.");
  const page=value.page===undefined||value.page===""?1:Number(value.page);if(!Number.isInteger(page)||page<1||page>10000)throw new ReferenceError("PAGE","Zgjidhni faqe nga 1 deri në 10000.");
  return {q,from,to,projectId,method:method as "cash"|"bank"|"all",status:status as "received"|"cancelled"|"all",page};
}
