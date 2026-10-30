import {modalPage} from '@/components/workspace/modal-page';
import { PaymentEdit } from "@/features/payments/screens";
export const metadata={title:"Shqyrtoni korrigjimin e pagesës"};
async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaymentEdit id={id}/>;}

export default modalPage(Page);
