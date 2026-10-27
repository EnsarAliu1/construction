import type {NextRequest} from "next/server";
import {paymentRequest} from "@/features/payments/http";
import {getReceipt} from "@/features/receipts/service";
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){const {id}=await context.params;return paymentRequest(request,(c,t)=>getReceipt(c,t,id,Number(request.nextUrl.searchParams.get("page")??1)));}
