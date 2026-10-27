import type { NextRequest } from "next/server";
import { expenseRequest } from "@/features/expenses/http";
import { correctExpense, getExpense } from "@/features/expenses/service";
type Context = {params:Promise<{id:string}>};
export async function GET(r:NextRequest,ctx:Context) { const {id}=await ctx.params; return expenseRequest(r,(c,t)=>getExpense(c,t,id)); }
export async function PUT(r:NextRequest,ctx:Context) { const {id}=await ctx.params; return expenseRequest(r,async(c,t,b)=>({record:await correctExpense(c,t,id,b)}),true); }
