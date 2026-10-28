import { MfaForm } from '@/components/auth/mfa-form';
import { safeReturnPath } from '@/server/auth/security';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secure verification | Construction workspace', robots: { index: false, follow: false } };
export default async function MfaPage({ searchParams }: {
    searchParams: Promise<{
        returnTo?: string;
    }>;
}) { const params = await searchParams; return <main className="login-layout"><section className="login-card card"><p className="eyebrow">Secure workspace</p><h1>Verify your sign-in</h1><MfaForm returnTo={safeReturnPath(params.returnTo)}/></section></main>; }
