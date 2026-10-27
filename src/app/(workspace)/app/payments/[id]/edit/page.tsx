import { PaymentEdit } from "@/features/payments/screens";
export const metadata={title:"Review payment correction"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaymentEdit id={id}/>;}
