import { MfaForm } from '@/components/auth/mfa-form';
import { requirePageUser } from '@/server/auth/web';
import { Card, PageHeading } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Siguria e llogarisë" };
export default async function SecurityPage() { await requirePageUser('/app/security'); return <><PageHeading title="Siguria e llogarisë" description="Ndryshoni aplikacionin e autentikimit ose kodet e rikuperimit pas verifikimit të ri të fjalëkalimit dhe kodit të autentikimit."/><Card><MfaForm returnTo="/app/security" change/></Card></>; }
