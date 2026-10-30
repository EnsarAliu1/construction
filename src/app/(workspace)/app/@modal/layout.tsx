import type {ReactNode} from 'react';
import {InterceptedForms} from '@/components/workspace/form-route';
export default function ModalLayout({children}:{children:ReactNode}){return <InterceptedForms>{children}</InterceptedForms>;}
