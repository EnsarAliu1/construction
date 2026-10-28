import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(`artifacts/wp13/${name}.json`,'utf8'));
const before=read('baseline-db'),after=read('optimized-db'),a=read('baseline-browser'),b=read('optimized-browser'),equivalence=read('financial-equivalence');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};
const result={scope:'Local production-build Windows laboratory with synthetic data. No field Core Web Vitals.',baselineCommit:'9f6586c987a90a5fe81c4222abd684836c466136',environment:Object.fromEntries(Object.entries(before.environment).filter(([key])=>!['dataset','label','mode'].includes(key))),browser:a.browser,dataset:{clients:equivalence.projects,projects:equivalence.projects,contracts:equivalence.projects,phases:equivalence.phases,payments:equivalence.incomeRows,allocations:equivalence.incomeRows,expenses:equivalence.expenseRows,bulkSyntheticAuditRows:12000,receiptVersions:1,note:'Recorded timing fixture includes one retained setup client/project. Before/after financial rows are identical. Export audit grows after downloads; fresh seed generates 1001 projects.'},financialEquivalence:equivalence,apiAndDatabase:{},publicBrowser:{},privateBrowser:{},plans:{before:before.plans,after:after.plans},status:{before:before.statusBefore,after:after.statusAfter},measurementProcessMemory:{before:before.measurementProcessMemory,after:after.measurementProcessMemory},limitations:['No CPU/network throttling; mobile viewport simulation only.','Small-sample nearest-rank p95 is close to maximum, not a production percentile.','Optimized database run partly overlapped lint startup; workstation scheduling and cache state vary.','Navigation measurements include networkidle settlement of at least 500 ms.','True process-cold distributions, INP and field p75 NOT VERIFIED.']};
for(const [name,value]of Object.entries(before.results)){
 const key=name.startsWith('/api/receipts/')?'receiptDownload':name;
 result.apiAndDatabase[key]={before:value,after:after.results[name]};
 if(value.medianMs)result.apiAndDatabase[key].medianChangePercent=Number(((after.results[name].medianMs/value.medianMs-1)*100).toFixed(2));
}
for(const mobile of [false,true])for(const [label,source]of [['before',a],['after',b]]){
 const samples=source.measurements.filter(row=>row.mobile===mobile),metrics={};
 for(const key of ['lcp','fcp','ttfb','domContentLoaded','longTasks','jsTransfer','totalTransfer']){
  const values=samples.map(row=>row[key]).filter(value=>typeof value==='number'&&(!['lcp','fcp'].includes(key)||value>0));metrics[key]={validSamples:values.length,median:median(values)};
 }
 result.publicBrowser[mobile?'mobile':'desktop']??={};result.publicBrowser[mobile?'mobile':'desktop'][label]={samples:samples.length,viewport:mobile?'390x844':'1440x1000',metrics,maxCLS:Math.max(...samples.map(row=>row.cls)),errors:source.errors};
}
for(const route of new Set(a.privateMeasurements.map(row=>row.route))){result.privateBrowser[route]={};for(const [label,source]of [['before',a],['after',b]])result.privateBrowser[route][label]={n:3,medianNavigationMs:median(source.privateMeasurements.filter(row=>row.route===route).map(row=>row.navigationMs))};}
result.interactions=Object.fromEntries([['before',a],['after',b]].map(([label,source])=>[label,{searchMs:source.searchMs,warmPublicNavigationMs:source.warmPublicNavigationMs}]));
result.concurrency=read('concurrency');delete result.concurrency.environment.dataset;
mkdirSync('docs/performance',{recursive:true});writeFileSync('docs/performance/wp13-measurements.json',JSON.stringify(result,null,2)+'\n');console.log('Wrote measured summary; fixture credentials and session tokens excluded.');
