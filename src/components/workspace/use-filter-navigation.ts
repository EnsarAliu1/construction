"use client";
import {useEffect,useRef,useTransition,type FormEvent} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';

/** Uses the existing validated GET parameters; changes navigation only, never business data. */
export function useFilterNavigation(path:string){
 const form=useRef<HTMLFormElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),router=useRouter(),query=useSearchParams(),[pending,start]=useTransition();
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{const input=form.current?.elements.namedItem('q') as HTMLInputElement|null;if(input&&document.activeElement!==input)input.value=query.get('q')??'';},[query]);
 function navigate(){
  if(timer.current)clearTimeout(timer.current);
  if(!form.current||!form.current.reportValidity())return;
  const params=new URLSearchParams();for(const [key,value] of new FormData(form.current)){if(typeof value==='string')params.set(key,value);}
  start(()=>router.replace(`${path}?${params}`,{scroll:false}));
 }
 function onSubmit(event:FormEvent){event.preventDefault();navigate();}
 function onInput(event:FormEvent){const target=event.target as HTMLInputElement;if(target.name!=='q')return;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(navigate,450);}
 return {form,pending,onSubmit,onInput};
}
