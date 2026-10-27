import { ExpenseDetailsScreen } from "@/features/expenses/screens";
export const metadata={title:"Expense details"};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string}>}){const {id}=await params;return <ExpenseDetailsScreen id={id} searchParams={searchParams}/>;}
