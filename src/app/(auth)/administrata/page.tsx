import {AuthFrame} from '@/components/auth/auth-frame';
import {PasskeyLogin} from '@/components/auth/passkey-login';
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/server/auth/web";
import { safeReturnPath } from "@/server/auth/security";
import {safeDemoEntryUrl,demoMode} from '@/server/demo/policy';
import {DemoLogin} from '@/components/auth/demo-login';
import {DemoEntryLink} from '@/components/public/demo-entry-link';

export const dynamic = "force-dynamic";
export const metadata = { title: "Construction", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; unavailable?: string; demo?:string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  let signedIn = false;
  let unavailable = params.unavailable === "1";
  try { signedIn = Boolean(await currentUser()); } catch { unavailable = true; }
  if (signedIn) redirect(returnTo);
  if(demoMode())return <AuthFrame><h1 id="login-title">Provojeni vetë.</h1><p className="login-description">Eksploroni aplikacionin me projekte, pagesa dhe raporte shembull.</p><DemoLogin automatic={params.demo==='1'}/></AuthFrame>;
  const demoUrl=safeDemoEntryUrl();
  return <AuthFrame>
    <h1 id="login-title">Mirë se vini.</h1><p className="login-description">Hapësira juaj. Gjithçka në vendin e vet.</p>
    <PasskeyLogin returnTo={returnTo}/><div className="auth-method-divider">ose hyni me email</div><LoginForm returnTo={returnTo} unavailable={unavailable} />
    {demoUrl&&<div className="demo-login"><DemoEntryLink className="demo-entry">Provo Demo <span aria-hidden="true">↗</span></DemoEntryLink><p className="muted">Eksploroni me të dhëna fiktive, pa regjistrim.</p></div>}
  </AuthFrame>;
}
