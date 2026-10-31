'use client';
import type {InputHTMLAttributes} from 'react';
import {groupedDecimal} from '@/lib/presentation';
/** Spaces group thousands; the parent always receives the original exact decimal string. */
export function MoneyInput({value,onChange,maxLength=20,className='',...props}:InputHTMLAttributes<HTMLInputElement>){
 return <input {...props} className={`input money-input ${className}`} type="text" inputMode="decimal" maxLength={maxLength+6} value={groupedDecimal(String(value??''))} onChange={event=>{
  const element=event.currentTarget,position=element.selectionStart??element.value.length;
  const logical=element.value.slice(0,position).replace(/[\s\u00a0\u202f]/g,'').length;
  const raw=element.value.replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
  if(raw.length>maxLength||!/^\d*(?:\.\d{0,2})?$/.test(raw)){element.value=groupedDecimal(String(value??''));return;}
  element.value=raw;onChange?.(event);
  requestAnimationFrame(()=>{if(document.activeElement!==element)return;const text=groupedDecimal(raw);let count=0,index=0;while(index<text.length&&count<logical){if(text[index]!==' ')count++;index++;}element.setSelectionRange(index,index);});
 }}/ >;
}
