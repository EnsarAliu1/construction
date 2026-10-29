const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type RecoveryKey={idempotencyKey:string};
/** Persist only a technical recovery identity, never payment amounts or allocations. */
export function readRecoveryKey(storage:Storage,key:string):RecoveryKey|null{
 const raw=storage.getItem(key);if(!raw)return null;
 try{const parsed=JSON.parse(raw);if(typeof parsed.idempotencyKey!=='string'||!uuid.test(parsed.idempotencyKey))throw new Error();const safe={idempotencyKey:parsed.idempotencyKey};storage.setItem(key,JSON.stringify(safe));return safe;}
 catch{storage.removeItem(key);return null;}
}
export function retainRecoveryKey(storage:Storage,key:string,idempotencyKey:string){
 if(!uuid.test(idempotencyKey))throw new Error("Identifikues i pavlefshëm rikuperimi.");storage.setItem(key,JSON.stringify({idempotencyKey}));
}
export function redactLegacyRecoveryDrafts(storage:Storage){
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>Boolean(key?.startsWith('fitimi.payment.pending.')));
 for(const key of keys)readRecoveryKey(storage,key);
}
