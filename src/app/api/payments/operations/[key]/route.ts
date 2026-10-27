import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { paymentOperationStatus } from "@/features/payments/service";
export async function GET(r:NextRequest,ctx:{params:Promise<{key:string}>}){const {key}=await ctx.params;return paymentRequest(r,(c,t)=>paymentOperationStatus(c,t,key));}
