import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { previewPaymentCorrection } from "@/features/payments/service";
export async function POST(r:NextRequest,ctx:{params:Promise<{id:string}>}){const {id}=await ctx.params;return paymentRequest(r,(c,t,b)=>previewPaymentCorrection(c,t,id,b),true);}
