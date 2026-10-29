import { requireOperationUser } from "@/server/auth/web";
import { authJson } from "@/server/auth/http";
import { AuthenticationRequired } from "@/server/auth/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return authJson({ user: await requireOperationUser() }); }
  catch (error) { return authJson({ message: "Kërkohet autentikim." }, error instanceof AuthenticationRequired ? 401 : 503); }
}
