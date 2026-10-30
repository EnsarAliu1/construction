import {Children,cloneElement,isValidElement,type ReactElement,type ReactNode,type TableHTMLAttributes} from 'react';

type CellProps={children?:ReactNode;colSpan?:number;'data-label'?:string;role?:string};
function text(node:ReactNode):string{
 return Children.toArray(node).map(child=>isValidElement<CellProps>(child)?text(child.props.children):typeof child==='string'||typeof child==='number'?String(child):'').join('');
}
function headers(node:ReactNode):string[]{
 return Children.toArray(node).flatMap(child=>isValidElement<CellProps>(child)?child.type==='th'?[text(child.props.children)]:headers(child.props.children):[]);
}
/** Server-rendered labels allow the same semantic table to become readable cards on mobile. */
export function DataTable({children,className='',...props}:TableHTMLAttributes<HTMLTableElement>){
 const labels=headers(children);
 function decorate(node:ReactNode,column={value:0}):ReactNode{
  return Children.map(node,child=>{
   if(!isValidElement<CellProps>(child))return child;
   const element=child as ReactElement<CellProps>;
   if(child.type==='tr')return cloneElement(element,{role:'row'},decorate(child.props.children,{value:0}));
   if(child.type==='td'){const label=labels[column.value]??'';column.value+=child.props.colSpan??1;return cloneElement(element,{role:'cell','data-label':child.props.colSpan?undefined:label});}
   if(child.type==='th')return cloneElement(element,{role:'columnheader'});
   return cloneElement(element,typeof child.type==='string'&&['thead','tbody','tfoot'].includes(child.type)?{role:'rowgroup'}:{},decorate(child.props.children,column));
  });
 }
 return <table {...props} role="table" className={`responsive-data-table ${className}`}>{decorate(children)}</table>;
}
