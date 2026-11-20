import {resolve} from 'node:path';
import {demoMode,DEMO_LABEL} from '@/server/demo/policy';

export type ReceiptCompany={name:string;address:string;city:string;nui:string;vatNumber:string;phone:string;email:string;bank:string;iban:string;vatStatus:'unspecified'|'registered'|'not-registered';vatRate:0|8|18;vatNote:string;logo:string;configured:boolean};
export type ReceiptBuyer={address?:string;city?:string;nui?:string;vatNumber?:string};

/** Deployment-owned presentation only. Never accepts request-provided paths or URLs. */
export function receiptCompany(env:Record<string,string|undefined>=process.env):ReceiptCompany{
 if(demoMode())env={RECEIPT_COMPANY_NAME:DEMO_LABEL,RECEIPT_COMPANY_ADDRESS:'Adresa fiktive e demonstrimit',RECEIPT_COMPANY_CITY:'Prishtinë',RECEIPT_VAT_STATUS:'not-registered'};
 const text=(key:string,max=255)=>{const value=(env[key]??'').trim();if(value.length>max||/[\u0000-\u001f\u007f-\u009f]/u.test(value))throw new Error('Profili i kompanisë për dokumente është i pavlefshëm.');return value;};
 const name=text('RECEIPT_COMPANY_NAME',200),status=text('RECEIPT_VAT_STATUS',24)||'unspecified';
 if(!['unspecified','registered','not-registered'].includes(status))throw new Error('Status i pavlefshëm i TVSH-së për dokumente.');
 const vatNumber=text('RECEIPT_VAT_NUMBER',40),rate=text('RECEIPT_VAT_RATE',2),vatNote=text('RECEIPT_VAT_NOTE',300);
 if(rate&&!['0','8','18'].includes(rate))throw new Error('Norma e TVSH-së duhet të jetë 0, 8 ose 18.');
 if(status==='registered'&&(!vatNumber||!rate||rate==='0'&&!vatNote))throw new Error('Plotësoni numrin, normën dhe arsyen për TVSH 0% në profilin e kompanisë.');
 if(status!=='registered'&&(vatNumber||rate))throw new Error('TVSH-ja paraqitet vetëm për profil të regjistruar shprehimisht.');
 const logo=text('RECEIPT_LOGO_FILE',100)||'construction.png';
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:png|jpe?g)$/i.test(logo)||logo.includes('..'))throw new Error('Logoja duhet të jetë skedar lokal brenda public/logos.');
 return {name:name||'Emri i kompanisë nuk është konfiguruar - VETËM PËR ZHVILLIM',address:text('RECEIPT_COMPANY_ADDRESS'),city:text('RECEIPT_COMPANY_CITY',150),nui:text('RECEIPT_COMPANY_NUI',100),vatNumber,phone:text('RECEIPT_COMPANY_PHONE',64),email:text('RECEIPT_COMPANY_EMAIL',254),bank:text('RECEIPT_COMPANY_BANK',150),iban:text('RECEIPT_COMPANY_IBAN',64),vatStatus:status as ReceiptCompany['vatStatus'],vatRate:status==='registered'?Number(rate) as 0|8|18:0,vatNote,logo:resolve('public/logos',logo),configured:Boolean(name)};
}
