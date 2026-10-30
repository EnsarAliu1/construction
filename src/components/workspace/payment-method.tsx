"use client";
import {WorkspaceIcon} from '@/components/layout/workspace-icon';
export function PaymentMethod({value,onChange,disabled}:{value:'cash'|'bank';onChange:(value:'cash'|'bank')=>void;disabled:boolean}){
 return <fieldset className="payment-method-picker"><legend>Mënyra e pagesës (e detyrueshme)</legend><div>{([['bank','Bankë','bank'],['cash','Para në dorë','payments']] as const).map(([method,label,icon])=><label key={method} className={value===method?'selected':''}><input className="sr-only" type="radio" name="payment-method" value={method} checked={value===method} disabled={disabled} onChange={()=>onChange(method)}/><WorkspaceIcon name={icon}/><span>{label}</span></label>)}</div></fieldset>;
}
