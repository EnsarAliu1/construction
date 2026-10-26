import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/server/auth/web";
import { safeReturnPath } from "@/server/auth/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in | Construction workspace", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; unavailable?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  let signedIn = false;
  let unavailable = params.unavailable === "1";
  try { signedIn = Boolean(await currentUser()); } catch { unavailable = true; }
  if (signedIn) redirect(returnTo);
  return <main className="login-layout"><section className="login-card card" aria-labelledby="login-title">
    <Link className="wordmark" href="/sq">Construction<span>MANAGEMENT WORKSPACE</span></Link>
    <p className="eyebrow">Your workspace</p><h1 id="login-title">Welcome back.</h1><p className="muted login-description">Sign in to access your construction workspace.</p>
    <LoginForm returnTo={returnTo} unavailable={unavailable} />
    <Link href="/sq" className="text-link">← Public website</Link>
  </section></main>;
}
