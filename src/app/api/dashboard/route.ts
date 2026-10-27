import type {NextRequest} from "next/server";
import {dashboard} from "@/features/reporting/export";
import {query,reportingRequest} from "@/features/reporting/http";
import {referenceObject} from "@/features/references/validation";
export function GET(r:NextRequest){return reportingRequest(r,async(c,t)=>{referenceObject(query(r),[]);return {dashboard:await dashboard(c,t)};});}
