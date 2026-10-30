import 'server-only';
import type {ReactNode} from 'react';
import {FormRoute} from './form-route';
/** Keep all existing server page guards/loaders; only change their presentation. */
export function modalPage<P extends object>(Page:(props:P)=>ReactNode|Promise<ReactNode>){
 return async function ModalPage(props:P){return <FormRoute>{await Page(props)}</FormRoute>;};
}
