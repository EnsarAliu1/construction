import {ReceiptDetails} from "@/features/receipts/screens";
export const metadata={title:"Versionet e dëftesës"};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){const {id}=await params;return <ReceiptDetails id={id} searchParams={searchParams}/>;}
