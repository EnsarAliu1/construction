/** Display only; database dates and exact decimal amounts remain unchanged. */
export function kosovoDate(value: unknown): string {
 const text=String(value??'');
 if(!text)return '—';
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text.split('-').reverse().join('/');
 const normalized=text.replace(' ','T');
 const iso=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)?normalized:normalized+'Z';
 const date=new Date(iso);
 if(Number.isNaN(date.getTime()))return text;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Belgrade',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=(key:string)=>parts.find(part=>part.type===key)?.value??'';
 return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`;
}
export function groupedDecimal(value:string):string {
 if(!/^-?\d*(?:\.\d*)?$/.test(value))return value;
 const [whole,fraction]=value.split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(fraction===undefined?'':'.'+fraction);
}
/** VAT is included in gross. Round the net once to cents; VAT is the remainder. */
export function includedVat(gross:string){
 if(!/^\d+\.\d{2}$/.test(gross))throw new Error('Shumë e pavlefshme.');
 const total=BigInt(gross.replace('.','')),net=(total*BigInt(100)+BigInt(59))/BigInt(118);
 const decimal=(v:bigint)=>`${v/BigInt(100)}.${String(v%BigInt(100)).padStart(2,'0')}`;
 return {net:decimal(net),vat:decimal(total-net),gross};
}
