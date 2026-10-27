import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { paymentProject } from "@/features/payments/service";
export async function GET(r:NextRequest,ctx:{params:Promise<{id:string}>}){const {id}=await ctx.params;return paymentRequest(r,(c,t)=>paymentProject(c,t,id));}
