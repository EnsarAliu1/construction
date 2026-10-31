import {kosovoDate} from "@/lib/presentation";
/** Presentation only: persisted identifiers, enums and historical data stay unchanged. */
const values: Record<string,string> = {
 active:"Aktiv",inactive:"Joaktiv",suspended:"Pezulluar",completed:"Përfunduar",cancelled:"Anuluar",recorded:"Regjistruar",received:"Pranuar",issued:"Lëshuar",draft:"Draft",archived:"Arkivuar",retired:"Tërhequr",prepared:"Përgatitur",
 cash:"Para në dorë",bank:"Transfer bankar",all:"Të gjitha",private_person:"Individ",business:"Biznes",deactivate:"çaktivizoj",reactivate:"riaktivizoj",
 client:"Klienti",project:"Projekti",contract:"Kontrata",contract_phase:"Faza e kontratës",payment:"Pagesa",payment_allocation:"Ndarja e pagesës",expense:"Shpenzimi",receipt:"Dëftesa",expense_category:"Kategoria e shpenzimit",person:"Personi / Furnitori",vehicle:"Automjeti",company:"Kompania",pdf:"PDF",xlsx:"XLSX",
};
export const valueLabel=(value:string):string=>values[value]??value;
const fields:Record<string,string>={id:"Identifikuesi",name:"Emri",displayName:"Emri i përdoruesit",email:"Emaili",type:"Lloji",status:"Gjendja",clientId:"Identifikuesi i klientit",projectId:"Identifikuesi i projektit",contractId:"Identifikuesi i kontratës",phaseId:"Identifikuesi i fazës",paymentId:"Identifikuesi i pagesës",receiptId:"Identifikuesi i dëftesës",categoryId:"Identifikuesi i kategorisë",personId:"Identifikuesi i furnitorit",vehicleId:"Identifikuesi i automjetit",amount:"Shuma",totalValue:"Vlera e përgjithshme",value:"Vlera",version:"Versioni",sortOrder:"Renditja",transactionDate:"Data e transaksionit",method:"Mënyra e pagesës",description:"Përshkrimi",location:"Lokacioni",startDate:"Data e fillimit",endDate:"Data e përfundimit",deletedAt:"Arkivuar më",cancelledAt:"Anuluar më",cancellationReason:"Arsyeja e anulimit",cancelledBy:"Anuluar nga",isActive:"Aktiv",identifier:"Identifikuesi",receiptNumber:"Numri i dëftesës",issuedAt:"Lëshuar më",clientName:"Emri i klientit",projectName:"Emri i projektit",issuerName:"Lëshuar nga",storageReference:"Referenca e ruajtjes",fileChecksum:"Hash-i i skedarit",resultId:"Identifikuesi i rezultatit",resultType:"Lloji i rezultatit",nui:"NUI",phone:"Telefoni",addressLine1:"Adresa, rreshti 1",addressLine2:"Adresa, rreshti 2",city:"Qyteti",postalCode:"Kodi postar",country:"Shteti",createdAt:"Krijuar më",updatedAt:"Përditësuar më",createdBy:"Krijuar nga",updatedBy:"Përditësuar nga",deletedBy:"Arkivuar nga",activatedAt:"Aktivizuar më",address:"Adresa",identificationReference:"Referenca identifikuese",deactivatedAt:"Çaktivizuar më",deactivatedBy:"Çaktivizuar nga",companyName:"Emri i kompanisë",documentVersion:"Versioni i dokumentit",paymentVersion:"Versioni i pagesës",allocationsText:"Ndarja në faza",from:"Data fillestare",to:"Data përfundimtare",q:"Kërkimi",page:"Faqja",category:"Kategoria",project:"Projekti",person:"Furnitori",vehicle:"Automjeti",newCategoryName:"Emri i kategorisë së re",confirmation:"Konfirmimi",allocations:"Ndarjet",contract:"Kontrata",phases:"Fazat",removePhaseIds:"Fazat për heqje"};
export const fieldLabel=(key:string):string=>fields[key]??"E dhënë shtesë";
export function fieldValue(key:string,value:unknown):string{
 if(value===null||value===undefined)return "Nuk është regjistruar";
 if(typeof value==='boolean')return value?"Po":"Jo";
 const text=String(value);
 if(/(?:At|Date)$/.test(key))return kosovoDate(value);
 return ['status','type','method','resultType'].includes(key)?valueLabel(text):text;
}
const entities:Record<string,string>={payment_allocation:"Ndarja e pagesës",contract_phase:"Faza e kontratës",client:"Klienti",project:"Projekti",contract:"Kontrata",phase:"Faza",payment:"Pagesa",allocation:"Ndarja",receipt:"Dëftesa",expense:"Shpenzimi",reference:"Të dhënat referuese"};
const actions:Record<string,string>={created:"u krijua",updated:"u përditësua",archived:"u arkivua",activated:"u aktivizua",deactivated:"u çaktivizua",reactivated:"u riaktivizua",corrected:"u korrigjua",cancelled:"u anulua",confirmed:"u konfirmua",issued:"u lëshua",retired:"u tërhoq",removed:"u hoq",reordered:"u rirendit",restored:"u rikthye"};
export function actionLabel(action:string):string{
 const parts=action.split('_'),verb=parts.pop()??'';
 const entity=entities[parts.join('_')]??(parts[0]==='phase'?'Faza':parts[0]==='allocation'?'Ndarja':undefined);
 return entity&&actions[verb]?`${entity} ${actions[verb]}`:"Veprim i regjistruar";
}
