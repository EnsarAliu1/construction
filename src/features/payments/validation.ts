import { inputMoney, cents, decimal } from "@/features/projects/money";
import { date, text } from "@/features/expenses/validation";
import { ReferenceError, referenceId, referenceObject, referenceVersion } from "@/features/references/validation";
export { ReferenceError as PaymentError };
export const MAX_ALLOCATIONS = 100;
export function positiveMoney(value: unknown, field: string) {
  try {
    if (typeof value !== "string" || !/^\d{1,17}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error();
    const amount = inputMoney(value); if (cents(amount) <= BigInt(0)) throw new Error(); return amount;
  } catch { throw new ReferenceError("AMOUNT", "Enter positive EUR amounts with at most two decimals.", 400, { [field]: "Use 0.01 to 99999999999999999.99 without separators." }); }
}
export function parsePayment(value: unknown) {
  const input = referenceObject(value,["projectId","projectVersion","contractId","contractVersion","amount","transactionDate","method","allocations"]);
  if (input.method !== "cash" && input.method !== "bank") throw new ReferenceError("METHOD","Select Cash or Bank transfer.",400,{method:"Select a supported method."});
  if (!Array.isArray(input.allocations) || input.allocations.length < 1 || input.allocations.length > MAX_ALLOCATIONS) throw new ReferenceError("ALLOCATIONS","Allocate the full payment across 1 to 100 phases.");
  const allocations = input.allocations.map(value => {
    const row = referenceObject(value,["phaseId","phaseVersion","amount"]);
    return { phaseId:referenceId(row.phaseId),phaseVersion:referenceVersion(row.phaseVersion),amount:positiveMoney(row.amount,`allocation-${String(row.phaseId)}`) };
  }).sort((a,b)=>a.phaseId.localeCompare(b.phaseId));
  if (new Set(allocations.map(row=>row.phaseId)).size !== allocations.length) throw new ReferenceError("DUPLICATE_PHASE","Each phase may occur only once.");
  const amount=positiveMoney(input.amount,"amount"),sum=allocations.reduce((total,row)=>total+cents(row.amount),BigInt(0));
  if(sum!==cents(amount))throw new ReferenceError("EQUALITY",`Allocations total ${decimal(sum)} EUR must equal the payment amount.`,400,{allocations:"Allocate the entire amount exactly."});
  return { projectId:referenceId(input.projectId), projectVersion:referenceVersion(input.projectVersion), contractId:referenceId(input.contractId),contractVersion:referenceVersion(input.contractVersion),amount,transactionDate:date(input.transactionDate),method:input.method as "cash"|"bank",allocations };
}
export type PaymentInput=ReturnType<typeof parsePayment>;
export function operationKey(value:unknown){return referenceId(value);}
export function parseConfirmation(value:unknown){const input=referenceObject(value,["idempotencyKey","payment"]);return {key:operationKey(input.idempotencyKey),payment:parsePayment(input.payment)};}
export function parseCorrection(value:unknown){const input=referenceObject(value,["version","confirmation","payment"]);if(input.confirmation!=="correct")throw new ReferenceError("CONFIRMATION","Explicitly confirm this correction.");return {version:referenceVersion(input.version),payment:parsePayment(input.payment)};}
export function parseCancellation(value:unknown){const input=referenceObject(value,["version","confirmation","reason"]);if(input.confirmation!=="cancel")throw new ReferenceError("CONFIRMATION","Explicitly confirm cancellation.");return {version:referenceVersion(input.version),reason:text(input.reason,"reason")};}
export function parsePaymentQuery(value:Record<string,unknown>){
  referenceObject(value,["q","from","to","projectId","method","status","page"]);
  const q=value.q===undefined?"":text(value.q,"q",100,false),from=value.from===undefined||value.from===""?"":date(value.from,"from"),to=value.to===undefined||value.to===""?"":date(value.to,"to");
  if(from&&to&&from>to)throw new ReferenceError("DATE","The end date must follow the start date.");
  const projectId=value.projectId===undefined||value.projectId===""?"":referenceId(value.projectId),method=value.method??"all",status=value.status??"received";
  if(!["cash","bank","all"].includes(String(method))||typeof method!=="string")throw new ReferenceError("METHOD","Invalid method filter.");
  if(status!=="received"&&status!=="cancelled"&&status!=="all")throw new ReferenceError("STATUS","Invalid status filter.");
  if(value.page!==undefined&&typeof value.page!=="string"&&typeof value.page!=="number")throw new ReferenceError("PAGE","Invalid page.");
  const page=value.page===undefined||value.page===""?1:Number(value.page);if(!Number.isInteger(page)||page<1||page>10000)throw new ReferenceError("PAGE","Select a page from 1 to 10000.");
  return {q,from,to,projectId,method:method as "cash"|"bank"|"all",status:status as "received"|"cancelled"|"all",page};
}
