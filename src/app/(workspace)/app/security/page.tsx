import { MfaForm } from '@/components/auth/mfa-form';
import { requirePageUser } from '@/server/auth/web';
import {Card} from "@/components/ui";
import {WorkspaceHeading as PageHeading} from '@/components/workspace/page-heading';
import {PasskeySettings} from '@/components/auth/passkey-settings';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Siguria e llogarisë" };
export default async function SecurityPage() { await requirePageUser('/app/security'); return <><PageHeading title="Siguria e llogarisë" description="Aktivizoni hyrjen e shpejtë dhe menaxhoni mënyrat rezervë të verifikimit."/><PasskeySettings/><Card><h2>Verifikimi rezervë dhe rikuperimi</h2><MfaForm returnTo="/app/security" change/></Card></>; }
