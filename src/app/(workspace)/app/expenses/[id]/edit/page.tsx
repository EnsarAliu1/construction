import { ExpenseEdit } from "@/features/expenses/screens";
export const metadata={title:"Korrigjoni shpenzimin"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ExpenseEdit id={id}/>;}
