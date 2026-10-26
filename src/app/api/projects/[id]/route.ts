import type { NextRequest } from "next/server";
import { projectRequest } from "@/features/projects/http";
import { getProject, updateProject } from "@/features/projects/service";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: Context) { return projectRequest(request, async (c, token) => getProject(c, token, (await params).id)); }
export async function PUT(request: NextRequest, { params }: Context) { return projectRequest(request, async (c, token, body) => ({ project: await updateProject(c, token, (await params).id, body) }), true); }
