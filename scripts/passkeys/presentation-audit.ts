import assert from 'node:assert/strict';
import type {Page} from '@playwright/test';

/** Inspect rendered CSS, including pseudo-elements and gradients, without reading business content. */
export async function assertNoBlue(page:Page,label:string){
 const findings=await page.evaluate(()=>{
  const found=new Set<string>();
  for(const el of document.querySelectorAll('.workspace-refresh *')){
   if(!el.getClientRects().length)continue;
   for(const pseudo of [null,'::before','::after']){
    const style=getComputedStyle(el,pseudo);
    if(style.visibility==='hidden'||style.display==='none'||style.opacity==='0'||(pseudo&&style.content==='none'))continue;
    const properties=['color','background-color','background-image','fill','stroke'];
    for(const side of ['top','right','bottom','left'])if(parseFloat(style.getPropertyValue(`border-${side}-width`))>0&&style.getPropertyValue(`border-${side}-style`)!=='none')properties.push(`border-${side}-color`);
    if(style.outlineStyle!=='none')properties.push('outline-color');
    for(const property of properties){
     const value=style.getPropertyValue(property);
     const blue=[...value.matchAll(/rgba?\(([^)]+)\)/g)].some(match=>{
      const values=match[1].replaceAll(',',' ').replace('/',' ').split(/\s+/).filter(Boolean).map(Number);
      if(values.length<3||(values.length>3&&values[3]<.2))return false;
      const [r,g,b]=values,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
      if(delta<12)return false;
      let hue=max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
      hue=(hue*60+360)%360;
      return hue>=165&&hue<=275;
     });
     if(blue)found.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${pseudo??''} ${property}: ${value}`);
    }
   }
  }
  return [...found].slice(0,20);
 });
 assert.deepEqual(findings,[],`${label}: no legacy blue/cyan presentation`);
}
