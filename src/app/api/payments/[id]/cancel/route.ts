import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { cancelPayment } from "@/features/payments/service";
export async function POST(r:NextRequest,ctx:{params:Promise<{id:string}>}){const {id}=await ctx.params;return paymentRequest(r,async(c,t,b)=>({payment:await cancelPayment(c,t,id,b)}),true);}
