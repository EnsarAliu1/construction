import {lstat,readFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {demoDatabase,demoMode} from './policy';

export function demoReceiptRoot(database:string){
 if(!demoMode()||!process.env.DEMO_RECEIPT_DIR)throw new Error('Dedicated demo receipt store required');
 const root=resolve(/* turbopackIgnore: true */ process.env.DEMO_RECEIPT_DIR),path=resolve(/* turbopackIgnore: true */ root,demoDatabase(database));
 if(!path.startsWith(root+sep))throw new Error('Invalid demo store');return path;
}
export async function removeDemoReceipts(database:string){
 const path=demoReceiptRoot(database);
 try{const stat=await lstat(/* turbopackIgnore: true */ path);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Unsafe demo directory');}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return;throw error;}
 const root=await lstat(/* turbopackIgnore: true */ resolve(/* turbopackIgnore: true */ process.env.DEMO_RECEIPT_DIR!));if(root.isSymbolicLink()||!root.isDirectory())throw new Error('Unsafe demo root');
 const markerPath=resolve(/* turbopackIgnore: true */ path,'.owner.json'),markerStat=await lstat(/* turbopackIgnore: true */ markerPath);if(markerStat.isSymbolicLink()||!markerStat.isFile())throw new Error('Unsafe demo marker');
 const marker=JSON.parse(await readFile(/* turbopackIgnore: true */ markerPath,'utf8'));
 if(marker.application!=='fitimi-private-receipts-v1'||typeof marker.database!=='string'||!marker.database.endsWith(`/${demoDatabase(database)}`))throw new Error('Unowned demo receipts');
 await rm(/* turbopackIgnore: true */ path,{recursive:true});
}
