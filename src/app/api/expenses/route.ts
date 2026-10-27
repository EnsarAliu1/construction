import type { NextRequest } from "next/server";
import { expenseRequest } from "@/features/expenses/http";
import { createExpense, listExpenses } from "@/features/expenses/service";
export const GET = (r: NextRequest) => expenseRequest(r,(c,t) => listExpenses(c,t,Object.fromEntries(r.nextUrl.searchParams)));
export const POST = (r: NextRequest) => expenseRequest(r,async(c,t,b) => ({record:await createExpense(c,t,b)}),true);
