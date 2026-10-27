import type { NextRequest } from "next/server";
import { paymentRequest } from "@/features/payments/http";
import { paymentOperationStatus } from "@/features/payments/service";
import {getPaymentReceipt} from "@/features/receipts/service";
export async function GET(r:NextRequest,ctx:{params:Promise<{key:string}>}){const {key}=await ctx.params;return paymentRequest(r,async(c,t)=>{const operation=await paymentOperationStatus(c,t,key);const receipt=typeof operation.paymentId==="string"?await getPaymentReceipt(c,t,operation.paymentId):null;return {...operation,documentAvailable:receipt?.documentAvailable??false,receiptId:receipt?.receipt.id??null};});}
