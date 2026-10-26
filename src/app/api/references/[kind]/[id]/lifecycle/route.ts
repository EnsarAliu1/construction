import type { NextRequest } from "next/server";
import { referenceRequest } from "@/features/references/http";
import { changeReferenceLifecycle } from "@/features/references/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const { kind, id } = await params; return referenceRequest(request, kind, async (c, token, kind, body) => ({ record: await changeReferenceLifecycle(c, token, kind, id, body) }), true); }
