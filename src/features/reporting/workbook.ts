import ExcelJS from 'exceljs';
import {readFile} from 'node:fs/promises';
import {receiptCompany} from '@/features/receipts/company-profile';
import {kosovoDate,groupedDecimal} from '@/lib/presentation';
import {valueLabel} from '@/i18n/format';
import {cents} from '@/features/projects/money';
import type {FinanceReport} from './finance';
import {reportPeriod} from './period';
import {limitError} from './validation';

const colors={ink:'FF192D25',green:'FF17634C',mint:'FFEAF3EC',paper:'FFF5F7F3',muted:'FF697B70',border:'FFDCE5DE',white:'FFFFFFFF',gold:'FFB88646'};
const fill=(argb:string):ExcelJS.Fill=>({type:'pattern',pattern:'solid',fgColor:{argb}});
const money=(value:string)=>`${groupedDecimal(value)} EUR`;

/** Runtime XLSX presentation: exact text amounts and all seven established datasets are retained. */
export async function reportWorkbook(r:FinanceReport,scope:string[]){
 const company=receiptCompany(),book=new ExcelJS.Workbook(),period=reportPeriod(r.filter);
 book.creator=company.name;book.created=new Date(r.generatedAt);book.modified=new Date(r.generatedAt);
 book.title=period.title;book.subject='Pasqyra operative e kompanisë';book.description='Raport operativ me të dhëna monetare të sakta dhe gjurmueshmëri.';
 const dashboard=book.addWorksheet('Pasqyra ekzekutive',{views:[{state:'frozen',ySplit:10,showGridLines:false,zoomScale:85}],properties:{tabColor:{argb:colors.green},defaultRowHeight:22},pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.3,right:.3,top:.35,bottom:.4,header:.15,footer:.2}}});
 dashboard.columns=Array.from({length:12},()=>({width:12}));
 for(let row=1;row<=47;row++)for(let col=1;col<=12;col++){const cell=dashboard.getCell(row,col);cell.fill=fill(colors.white);cell.font={name:'Aptos',size:10,color:{argb:colors.ink}};cell.alignment={vertical:'middle'};}
 function block(range:string,value:string|number,options:{background?:string;color?:string;size?:number;bold?:boolean;align?:'left'|'right'|'center'}={}){
  dashboard.mergeCells(range);const cell=dashboard.getCell(range.split(':')[0]);cell.value=value;cell.fill=fill(options.background??colors.white);cell.font={name:'Aptos',size:options.size??10,bold:options.bold??false,color:{argb:options.color??colors.ink}};cell.alignment={vertical:'middle',horizontal:options.align??'left',wrapText:true,indent:1};return cell;
 }
 for(let row=1;row<=6;row++)for(let col=1;col<=12;col++)dashboard.getCell(row,col).fill=fill(colors.ink);
 block('A2:A3','',{background:colors.mint});
 const logo=book.addImage({base64:(await readFile(company.logo)).toString('base64'),extension:/\.jpe?g$/i.test(company.logo)?'jpeg':'png'});
 dashboard.addImage(logo,{tl:{col:.28,row:1.05},ext:{width:43,height:50},editAs:'oneCell'});
 block('B2:L3',company.name,{size:23,bold:true,color:colors.white,background:colors.ink});
 block('B4:L4','PASQYRË FINANCIARE  /  RAPORT I MENAXHIMIT',{size:9,color:'FFB6CFBD',background:colors.ink});
 block('B5:L5',[company.city,company.nui?'NUI '+company.nui:'',company.email].filter(Boolean).join('  ·  ')||'Gjendje operative e kompanisë',{size:9,color:'FFB6CFBD',background:colors.ink});
 dashboard.getRow(7).height=14;dashboard.getRow(8).height=34;
 block('A8:L8',period.title,{size:21,bold:true});
 block('A9:L9',`${period.range}  ·  Gjeneruar më ${kosovoDate(r.generatedAt)}`,{size:10,color:colors.muted});
 const card=(first:string,last:string,label:string,value:string,note:string,background=colors.paper,color=colors.ink)=>{
  block(`${first}11:${last}11`,label,{background,color,size:9,bold:true});
  block(`${first}12:${last}13`,money(value),{background,color,size:value.length>17?14:19,bold:true});
  block(`${first}14:${last}14`,note,{background,color,size:8});
 };
 card('A','C','TË HYRA TË PRANUARA',r.totals.income,`${r.income.length} pagesa sipas filtrit`,colors.green,colors.white);
 card('D','F','SHPENZIME TË REGJISTRUARA',r.totals.expenses,`${r.outgoing.length} shpenzime sipas filtrit`);
 card('G','I','DIFERENCA OPERATIVE',r.totals.difference,'Të hyra minus shpenzime',colors.ink,colors.white);
 card('J','L','MBETUR SIPAS KONTRATAVE',r.totals.outstanding,'Gjendje e plotë, në të gjitha datat',colors.mint,colors.green);
 dashboard.getRow(15).height=15;
 block('A16:F16','LËVIZJA E MJETEVE',{bold:true,size:10});block('G16:L16','PORTOFOLI I KOMPANISË',{bold:true,size:10});
 const maximum=[cents(r.totals.income),cents(r.totals.expenses),BigInt(1)].reduce((a,b)=>a>b?a:b);
 for(const [index,[label,value,color]]of [['Të hyra',r.totals.income,colors.green],['Shpenzime',r.totals.expenses,colors.gold]].entries()){
  const row=18+index*4;block(`A${row}:C${row}`,label,{color:colors.muted});block(`D${row}:F${row}`,money(value),{bold:true,align:'right'});
  const units=Number((cents(value)*BigInt(6)+maximum/BigInt(2))/maximum);dashboard.getRow(row+1).height=7;
  for(let col=1;col<=6;col++)dashboard.getCell(row+1,col).fill=fill(col<=units?color:colors.mint);
 }
 const portfolio=[['Projekte aktive',r.activeProjects],['Kontrata gjithsej',money(r.totals.contractValue)],['Shpenzime pa projekt',money(r.totals.companyExpenses)],['Pagesa bankare',money(r.methods.find(m=>m.method==='bank')?.amount??'0.00')]] as const;
 for(const [i,[label,value]]of portfolio.entries()){const row=18+i*2;block(`G${row}:I${row}`,label,{color:colors.muted});block(`J${row}:L${row}`,value,{bold:true,align:'right',size:typeof value==='string'&&value.length>23?8:10});}
 block('A25:F25','Shiritet krahasojnë të hyrat dhe shpenzimet e periudhës.',{size:8,color:colors.muted});
 block('A27:L27','PROJEKTET ME LËVIZJEN MË TË MADHE NË PERIUDHË',{bold:true,size:10});
 block('A28:F28','PROJEKTI',{background:colors.mint,color:colors.green,bold:true,size:9});block('G28:I28','TË HYRA  /  EUR',{background:colors.mint,color:colors.green,bold:true,size:9,align:'right'});block('J28:L28','SHPENZIME  /  EUR',{background:colors.mint,color:colors.green,bold:true,size:9,align:'right'});
 const top=[...r.breakdowns].sort((a,b)=>{const av=cents(a.income)+cents(a.expenses),bv=cents(b.income)+cents(b.expenses);return av===bv?a.name.localeCompare(b.name,'sq'):av>bv?-1:1;}).slice(0,5);
 for(let i=0;i<5;i++){const row=29+i,item=top[i],background=i%2?colors.white:colors.paper;dashboard.getRow(row).height=29;block(`A${row}:F${row}`,item?.name??(i===0?'Nuk ka lëvizje sipas filtrit.':''),{background,size:9});block(`G${row}:I${row}`,item?groupedDecimal(item.income):'',{background,align:'right',size:9});block(`J${row}:L${row}`,item?groupedDecimal(item.expenses):'',{background,align:'right',size:9});}
 block('A35:L35','HAP TË DHËNAT E DETAJUARA',{bold:true,size:9,color:colors.muted});
 const links=[['A36:D36','Pagesat'],['E36:H36','Shpenzimet'],['I36:L36','Ndarja sipas projekteve'],['A38:D38','Kategoritë'],['E38:H38','Mënyrat e pagesës'],['I38:L38','Të dhënat shpjeguese']];
 for(const [range,name]of links){const cell=block(range,name+'  →',{background:colors.mint,bold:true,size:9,color:colors.green});cell.value={text:name+'  →',hyperlink:`#'${name}'!A1`};}
 dashboard.getRow(40).height=34;block('A40:L40','Diferenca operative nuk është fitim kontabël. Balancat e kontratave janë në të gjitha datat; të hyrat dhe shpenzimet ndjekin filtrat e zgjedhur.',{size:9,color:colors.muted});
 dashboard.getRow(42).height=34;block('A42:L42','Saktësia ruhet deri në cent: shumat janë tekst dhjetor, pa konvertim në numra me presje lëvizëse. Fletët burimore ruajnë identifikuesit dhe çdo vlerë të plotë.',{size:9,color:colors.muted});
 dashboard.pageSetup.printArea='A1:L43';dashboard.headerFooter.oddFooter='&LRaport operativ i kompanisë&C&P / &N&RPër përdorim të brendshëm';

 function sheet(name:string,headers:string[],rows:(string|number)[][],widths:number[]){
  const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1,showGridLines:false,zoomScale:85}],properties:{defaultRowHeight:28,tabColor:{argb:colors.green}},pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1',margins:{left:.3,right:.3,top:.5,bottom:.5,header:.2,footer:.2}}});
  s.addRow(headers);for(const row of rows)s.addRow(row);
  s.columns.forEach((column,i)=>{column.width=widths[i]??30;column.numFmt='@';});
  s.eachRow(row=>{
   row.font={name:'Aptos',size:10,color:{argb:colors.ink}};row.alignment={vertical:'middle',wrapText:true};
   let rowHeight=28;row.eachCell((cell,col)=>{rowHeight=Math.max(rowHeight,Math.ceil(String(cell.value??'').length/Math.max(16,(widths[col-1]??30)-3))*14+10);});
   row.height=row.number===1?44:Math.min(409,rowHeight);
   row.eachCell((cell,col)=>{if(typeof cell.value==='string'&&cell.value.length>32767)throw limitError();cell.fill=fill(row.number===1?colors.green:row.number%2?colors.paper:colors.white);cell.border={bottom:{style:'hair',color:{argb:colors.border}}};if(row.number===1){cell.font={name:'Aptos',bold:true,size:10,color:{argb:colors.white}};cell.alignment={vertical:'middle',wrapText:true};}else if(headers[col-1]?.includes('EUR'))cell.alignment={vertical:'middle',horizontal:'right',wrapText:true};});
  });
  s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
  s.headerFooter.oddHeader=`&L${company.name.replaceAll('&','&&')}&R${name}`;s.headerFooter.oddFooter='&LRaport operativ&C&P / &N&RVlerat monetare janë tekst i saktë';return s;
 }
 sheet('Përmbledhja',[period.title,'EUR të sakta / vlera'],[['Kompania',company.name],['Të hyrat e pranuara',r.totals.income],['Shpenzimet e regjistruara',r.totals.expenses],['Diferenca operative',r.totals.difference],['Shpenzimet e kompanisë',r.totals.companyExpenses],['Numri i pagesave',r.income.length],['Numri i shpenzimeve',r.outgoing.length],['Periudha e transaksioneve',period.range]],[44,42]);
 sheet('Pagesat',['Identifikuesi i pagesës','Data e transaksionit','Projekti','Klienti','Mënyra','EUR të sakta'],r.income.map(p=>[String(p.id),kosovoDate(p.transactionDate),String(p.projectName),String(p.clientName),valueLabel(String(p.method)),String(p.amount)]),[39,18,33,30,20,25]);
 sheet('Shpenzimet',['Identifikuesi i shpenzimit','Data e transaksionit','Projekti / Kompania','Kategoria','Përshkrimi','EUR të sakta'],r.outgoing.map(e=>[String(e.id),kosovoDate(e.transactionDate),String(e.projectName),String(e.categoryName),String(e.description),String(e.amount)]),[39,18,30,25,52,25]);
 sheet('Ndarja sipas projekteve',['Identifikuesi i projektit','Projekti','EUR të pranuara','Shpenzime të drejtpërdrejta në EUR'],[...r.breakdowns.map(p=>[p.id,p.name,p.income,p.expenses]),['','Kompania (pa projekt)','0.00',r.totals.companyExpenses]],[39,44,28,34]);
 sheet('Kategoritë',['Identifikuesi i kategorisë','Kategoria','EUR të regjistruara'],r.categories.map(c=>[c.id,c.name,c.amount]),[39,50,28]);
 sheet('Mënyrat e pagesës',['Mënyra','EUR të pranuara'],r.methods.map(m=>[valueLabel(m.method),m.amount]),[40,30]);
 sheet('Të dhënat shpjeguese',['Vetia','Vlera'],[...scope.map((value,i)=>[String(i+1),value]),['Saktësia monetare','TEKST dhjetor i saktë, përfshirë totalet. Pa shuma me presje lëvizëse ose formula të ekzekutueshme. Datat janë tekst kalendarik DD/MM/YYYY; identifikuesit mbeten tekst.'],['Skema e eksportit','fitimi-company-report/1'],['Paraqitja','Pasqyrë ekzekutive + shtatë fletët burimore; pozicionet e të dhënave burimore ruhen.'],['Rregullat','Vetëm raport i kompanisë; nuk ka eksporte financiare për projekte individuale.']],[36,110]);
 for(const s of book.worksheets){s.eachRow(row=>row.eachCell(cell=>{const value=cell.value;if(typeof value==='string'&&value.length>32767)throw limitError();}));}
 const bytes=Buffer.from(await book.xlsx.writeBuffer());if(bytes.length>16*1024*1024)throw limitError();return bytes;
}
