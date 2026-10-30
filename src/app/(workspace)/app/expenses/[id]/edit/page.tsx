import {modalPage} from '@/components/workspace/modal-page';
import { ExpenseEdit } from "@/features/expenses/screens";
export const metadata={title:"Korrigjoni shpenzimin"};
async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ExpenseEdit id={id}/>;}

export default modalPage(Page);
