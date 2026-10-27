import type {NextRequest} from "next/server";
import {exportBusiness} from "@/features/reporting/export";
import {reportingRequest} from "@/features/reporting/http";
export function POST(r:NextRequest){return reportingRequest(r,(c,t,body)=>exportBusiness(c,t,body),true);}
