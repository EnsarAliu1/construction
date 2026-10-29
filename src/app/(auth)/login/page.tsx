import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/server/auth/web";
import { safeReturnPath } from "@/server/auth/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hyrja | Sistemi i ndërtimit", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; unavailable?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  let signedIn = false;
  let unavailable = params.unavailable === "1";
  try { signedIn = Boolean(await currentUser()); } catch { unavailable = true; }
  if (signedIn) redirect(returnTo);
  return <main className="login-layout"><section className="login-card card" aria-labelledby="login-title">
    <Link className="wordmark" href="/sq">Ndërtim<span>SISTEMI I MENAXHIMIT</span></Link>
    <p className="eyebrow">Hapësira juaj e punës</p><h1 id="login-title">Mirë se vini përsëri.</h1><p className="muted login-description">Hyni për të përdorur sistemin e menaxhimit të ndërtimit.</p>
    <LoginForm returnTo={returnTo} unavailable={unavailable} />
    <Link href="/sq" className="text-link">← Faqja publike</Link>
  </section></main>;
}
