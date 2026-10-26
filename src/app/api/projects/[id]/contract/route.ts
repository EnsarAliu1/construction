import type { NextRequest } from "next/server";
import { projectRequest } from "@/features/projects/http";
import { saveContract } from "@/features/projects/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return projectRequest(request, async (c, token, body) => ({ contract: await saveContract(c, token, (await params).id, body) }), true); }
