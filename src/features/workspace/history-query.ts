export const historyTypes: Record<string,string> = {
 client:'Klientët',project:'Punishtet',contract:'Kontratat',contract_phase:'Fazat e kontratave',
 payment:'Pagesat',payment_allocation:'Ndarjet e pagesave',expense:'Shpenzimet',receipt:'Dëftesat',
 expense_category:'Kategoritë',person:'Personat & Furnitorët',vehicle:'Automjetet',authentication:'Siguria e llogarive',
};
export function parseHistoryQuery(params:Record<string,unknown>){
 const type=params.type??'all',entityId=params.entityId??'',page=params.page??'1';
 if(typeof type!=='string'||(type!=='all'&&!Object.hasOwn(historyTypes,type))||typeof entityId!=='string'||(entityId!==''&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(entityId))||typeof page!=='string'||!/^\d{1,4}$/.test(page)||Number(page)<1||Number(page)>1000)throw new Error('Filtrat e historikut nuk janë të vlefshëm.');
 return {type,entityId,page:Number(page)};
}
