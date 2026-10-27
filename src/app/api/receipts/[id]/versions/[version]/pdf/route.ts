import type {NextRequest} from "next/server";
import {receiptDownloadRequest} from "@/features/receipts/http";
export const runtime="nodejs";
export async function GET(request:NextRequest,context:{params:Promise<{id:string;version:string}>}){const {id,version}=await context.params;return receiptDownloadRequest(request,id,version);}
