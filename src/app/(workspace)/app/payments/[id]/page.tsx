import { PaymentDetailsScreen } from "@/features/payments/screens";
export const metadata={title:"Payment details"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaymentDetailsScreen id={id}/>;}
