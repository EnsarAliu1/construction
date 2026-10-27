import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { getPayment } from "@/features/payments/service";
import {correctPaymentWithReceipt} from "@/features/receipts/service";
type Ctx={params:Promise<{id:string}>};
export async function GET(r:NextRequest,ctx:Ctx){const {id}=await ctx.params;return paymentRequest(r,(c,t)=>getPayment(c,t,id));}
export async function PUT(r:NextRequest,ctx:Ctx){const {id}=await ctx.params;return paymentRequest(r,async(c,t,b)=>({payment:await correctPaymentWithReceipt(c,t,id,b)}),true);}
