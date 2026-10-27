import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { previewPayment } from "@/features/payments/service";
export const POST=(r:NextRequest)=>paymentRequest(r,(c,t,b)=>previewPayment(c,t,b),true);
