import type {NextRequest} from "next/server";
import {companyReport,exportCompany} from "@/features/reporting/export";
import {query,reportingRequest} from "@/features/reporting/http";
export function GET(r:NextRequest){return reportingRequest(r,async(c,t)=>({report:await companyReport(c,t,query(r))}));}
export function POST(r:NextRequest){return reportingRequest(r,(c,t,body)=>exportCompany(c,t,body),true);}
