import type { NextRequest } from "next/server";
import { expenseRequest } from "@/features/expenses/http";
import { cancelExpense } from "@/features/expenses/service";
export async function POST(r:NextRequest,ctx:{params:Promise<{id:string}>}) { const {id}=await ctx.params; return expenseRequest(r,async(c,t,b)=>({record:await cancelExpense(c,t,id,b)}),true); }
