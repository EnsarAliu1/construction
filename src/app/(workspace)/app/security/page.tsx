import { MfaForm } from '@/components/auth/mfa-form';
import { requirePageUser } from '@/server/auth/web';
import { Card, PageHeading } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account security' };
export default async function SecurityPage() { await requirePageUser('/app/security'); return <><PageHeading title="Account security" description="Replace your authenticator or recovery codes after fresh password and authenticator verification."/><Card><MfaForm returnTo="/app/security" change/></Card></>; }
