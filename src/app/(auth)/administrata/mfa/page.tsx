import { MfaForm } from '@/components/auth/mfa-form';
import {AuthFrame} from '@/components/auth/auth-frame';
import { safeReturnPath } from '@/server/auth/security';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Construction", robots: { index: false, follow: false } };
export default async function MfaPage({ searchParams }: {
    searchParams: Promise<{
        returnTo?: string;
    }>;
}) { const params = await searchParams; return <AuthFrame verification><h1 id="login-title">Një hap nga<br/>hapësira juaj.</h1><p className="login-description">Konfirmoni hyrjen me aplikacionin e autentikimit.</p><MfaForm returnTo={safeReturnPath(params.returnTo)}/></AuthFrame>; }
