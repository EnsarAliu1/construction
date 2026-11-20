import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import type {Connection} from 'mysql2/promise';
import {localDatabaseOptions} from '../../src/server/db/config';
import {createClient} from '../../src/features/clients/service';
import {createProject,getProject} from '../../src/features/projects/service';
import {confirmPaymentWithReceipt,correctPaymentWithReceipt,cancelPaymentWithReceipt,getPaymentReceipt,downloadReceipt} from '../../src/features/receipts/service';
import {checksum} from '../../src/features/receipts/storage';

/** Runs only inside the existing ownership-guarded synthetic security laboratory. */
export async function verifyReceiptPresentation(c:Connection,token:string){
 const options=localDatabaseOptions(process.env.TEST_DATABASE_URL,'test',process.env.DATABASE_DISPOSABLE);
 assert.match(options.database??'',/^fitimi_test_security_[a-f0-9]{8}$/);assert.equal(options.port,3307);
 const client=await createClient(c,token,{type:'business',name:'Klienti provues i dokumenteve',nui:'000000000 (SHEMBULL)',addressLine1:'Rruga e provës, nr. 20',city:'Prishtinë'});
 const project=await createProject(c,token,{project:{name:'Projekti provues i dokumenteve',clientId:client.id,clientVersion:client.version,status:'active'},contract:{totalValue:'1000.00',phases:[{name:'Faza e pagesës',value:'1000.00',sortOrder:0}]}});
 async function payment(amount:string,method:'cash'|'bank'){
  const d=await getProject(c,token,project.id);
  return {projectId:d.project.id,projectVersion:d.project.version,contractId:d.contract!.id,contractVersion:d.contract!.version,amount,transactionDate:'2026-11-20',method,allocations:[{phaseId:d.phases[0].id,phaseVersion:d.phases[0].version,amount}]};
 }
 const request={idempotencyKey:randomUUID(),payment:await payment('118.00','bank')},issued=await confirmPaymentWithReceipt(c,token,request);
 const original=(await downloadReceipt(c,token,issued.receiptId,1)).bytes;
 await correctPaymentWithReceipt(c,token,issued.paymentId,{version:1,confirmation:'correct',payment:await payment('236.00','cash')});
 const corrected=(await downloadReceipt(c,token,issued.receiptId,2)).bytes,current=await getPaymentReceipt(c,token,issued.paymentId);
 assert(current);assert.equal(current.receipt.receiptNumber,issued.receiptNumber);assert.equal(current.total,2);assert.notEqual(checksum(original),checksum(corrected));assert.equal(checksum((await downloadReceipt(c,token,issued.receiptId,1)).bytes),checksum(original));
 const replay=await confirmPaymentWithReceipt(c,token,request);assert.equal(replay.replayed,true);assert.equal(replay.documentVersion,1);
 await cancelPaymentWithReceipt(c,token,issued.paymentId,{version:2,confirmation:'cancel',reason:'Anulim sintetik për verifikimin e historikut të PDF-së'});
 assert.equal((await getPaymentReceipt(c,token,issued.paymentId))!.receipt.status,'void');assert.equal((await getProject(c,token,project.id)).phases[0].paid,'0.00');
 assert.equal(checksum((await downloadReceipt(c,token,issued.receiptId,1)).bytes),checksum(original));assert.equal(checksum((await downloadReceipt(c,token,issued.receiptId,2)).bytes),checksum(corrected));
 await mkdir('artifacts/documents',{recursive:true});await writeFile('artifacts/documents/runtime-receipt-v1.pdf',original);await writeFile('artifacts/documents/runtime-receipt-v2.pdf',corrected);
 await writeFile('artifacts/documents/lifecycle-verification.json',JSON.stringify({syntheticOnly:true,originalPdfRetained:true,correctedPdfDistinct:true,receiptNumberRetained:true,idempotentOriginalVersion:true,cancellationRetainsEveryPdf:true,phasePaidAfterCancellation:'0.00',originalChecksum:checksum(original),correctedChecksum:checksum(corrected)},null,2));
}
