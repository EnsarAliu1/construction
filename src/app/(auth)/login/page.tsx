import {AuthFrame} from '@/components/auth/auth-frame';
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/server/auth/web";
import { safeReturnPath } from "@/server/auth/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fitimi Construction", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; unavailable?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  let signedIn = false;
  let unavailable = params.unavailable === "1";
  try { signedIn = Boolean(await currentUser()); } catch { unavailable = true; }
  if (signedIn) redirect(returnTo);
  return <AuthFrame>
    <h1 id="login-title">Mirë se vini<br/>përsëri.</h1><p className="login-description">Hyni në hapësirën tuaj të punës dhe vazhdoni aty ku e latë.</p>
    <LoginForm returnTo={returnTo} unavailable={unavailable} />
  </AuthFrame>;
}
