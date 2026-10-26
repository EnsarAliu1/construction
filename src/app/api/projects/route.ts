import type { NextRequest } from "next/server";
import { projectRequest } from "@/features/projects/http";
import { createProject, listProjects } from "@/features/projects/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return projectRequest(request, (c, token) => listProjects(c, token, Object.fromEntries(request.nextUrl.searchParams))); }
export async function POST(request: NextRequest) { return projectRequest(request, async (c, token, body) => ({ project: await createProject(c, token, body) }), true); }
