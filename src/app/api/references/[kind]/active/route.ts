import type { NextRequest } from "next/server";
import { referenceRequest } from "@/features/references/http";
import { selectActiveReferences } from "@/features/references/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) { return referenceRequest(request, (await params).kind, async (c, token, kind) => ({ rows: await selectActiveReferences(c, token, kind, request.nextUrl.searchParams.get("q") ?? "") })); }
