import type { NextRequest } from "next/server";
import { referenceRequest } from "@/features/references/http";
import { getReference, updateReference } from "@/features/references/service";
type Context = { params: Promise<{ kind: string; id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: Context) { const { kind, id } = await params; return referenceRequest(request, kind, (c, token, kind) => getReference(c, token, kind, id)); }
export async function PUT(request: NextRequest, { params }: Context) { const { kind, id } = await params; return referenceRequest(request, kind, async (c, token, kind, body) => ({ record: await updateReference(c, token, kind, id, body) }), true); }
