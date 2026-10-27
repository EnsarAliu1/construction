import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { confirmPayment, listPayments } from "@/features/payments/service";
export const GET=(r:NextRequest)=>paymentRequest(r,(c,t)=>listPayments(c,t,Object.fromEntries(r.nextUrl.searchParams)));
export const POST=(r:NextRequest)=>paymentRequest(r,(c,t,b)=>confirmPayment(c,t,b),true);
