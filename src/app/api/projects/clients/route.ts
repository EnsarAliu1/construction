import type { NextRequest } from "next/server";
import { projectRequest } from "@/features/projects/http";
import { chooseClients } from "@/features/projects/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return projectRequest(request, async (c, token) => ({ rows: await chooseClients(c, token, request.nextUrl.searchParams.get("q") ?? "") })); }
