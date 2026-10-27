import type {NextRequest} from "next/server";
import {paymentRequest} from "@/features/payments/http";
import {listReceipts} from "@/features/receipts/service";
export const GET=(r:NextRequest)=>paymentRequest(r,(c,t)=>listReceipts(c,t,Object.fromEntries(r.nextUrl.searchParams)));
