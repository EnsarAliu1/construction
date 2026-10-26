import type { NextRequest } from "next/server";
import { referenceRequest } from "@/features/references/http";
import { createReference, listReferences } from "@/features/references/service";
type Context = { params: Promise<{ kind: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: Context) { return referenceRequest(request, (await params).kind, (c, token, kind) => listReferences(c, token, kind, Object.fromEntries(request.nextUrl.searchParams))); }
export async function POST(request: NextRequest, { params }: Context) { return referenceRequest(request, (await params).kind, async (c, token, kind, body) => ({ record: await createReference(c, token, kind, body) }), true); }
