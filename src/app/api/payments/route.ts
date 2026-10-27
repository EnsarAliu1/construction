import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { listPayments } from "@/features/payments/service";
import {confirmPaymentWithReceipt} from "@/features/receipts/service";
export const GET=(r:NextRequest)=>paymentRequest(r,(c,t)=>listPayments(c,t,Object.fromEntries(r.nextUrl.searchParams)));
export const POST=(r:NextRequest)=>paymentRequest(r,(c,t,b)=>confirmPaymentWithReceipt(c,t,b),true);
