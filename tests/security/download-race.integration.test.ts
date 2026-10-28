import assert from "node:assert/strict";
import test from "node:test";
import {paymentFixture,mysqlSkip} from "../payments/fixtures";
import {confirmPaymentWithReceipt,downloadReceipt} from "../../src/features/receipts/service";
import {PrivateReceiptStore} from "../../src/features/receipts/storage";
import {revokeSession} from "../../src/server/auth/sessions";
import {AuthenticationRequired} from "../../src/server/auth/security";

test("receipt bytes are denied when a real session is revoked during filesystem verification",{skip:mysqlSkip},async t=>{
 const f=await paymentFixture();
 try{
  const d=await f.fresh(),issued=await confirmPaymentWithReceipt(f.connection,f.token,f.confirmation(d));
  const original=PrivateReceiptStore.prototype.read;let intercepted=false;
  t.mock.method(PrivateReceiptStore.prototype,"read",async function(this:PrivateReceiptStore,key:string,hash:string){
   const bytes=await original.call(this,key,hash);
   if(!intercepted){intercepted=true;await f.independent(c=>revokeSession(c,f.token));}
   return bytes;
  });
  await assert.rejects(downloadReceipt(f.connection,f.token,issued.receiptId,1),AuthenticationRequired);
  assert.equal(intercepted,true);
 }finally{await f.close();}
});
