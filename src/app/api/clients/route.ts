import type { NextRequest } from "next/server";
import { clientRequest } from "@/features/clients/http";
import { createClient, listClients } from "@/features/clients/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return clientRequest(request, (connection, token) => listClients(connection, token, {
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
  }));
}
export async function POST(request: NextRequest) {
  return clientRequest(request, async (connection, token, body) => ({ client: await createClient(connection, token, body) }), true);
}
