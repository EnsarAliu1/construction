import type { NextRequest } from "next/server";
import { expenseRequest } from "@/features/expenses/http";
import { chooseExpenseProjects } from "@/features/expenses/service";
export const GET = (r:NextRequest) => expenseRequest(r,async(c,t)=>({rows:await chooseExpenseProjects(c,t,r.nextUrl.searchParams.get("q")??"",r.nextUrl.searchParams.get("scope")==="history")}));
