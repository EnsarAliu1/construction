import type { NextRequest } from "next/server";
import { clientRequest } from "@/features/clients/http";
import { archiveClient, getClient, updateClient } from "@/features/clients/service";
import { ClientValidationError } from "@/features/clients/validation";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: Context) {
  return clientRequest(request, async (connection, token) => getClient(connection, token, (await params).id));
}
export async function PUT(request: NextRequest, { params }: Context) {
  return clientRequest(request, async (connection, token, body) => {
    const { version, ...input } = body;
    return { client: await updateClient(connection, token, (await params).id, version, input) };
  }, true);
}
export async function DELETE(request: NextRequest, { params }: Context) {
  return clientRequest(request, async (connection, token, body) => {
    if (Object.keys(body).some(key => !["version", "confirmation"].includes(key))) throw new ClientValidationError({ form: "Unsupported archive fields." });
    return { client: await archiveClient(connection, token, (await params).id, body.version, body.confirmation) };
  }, true);
}
