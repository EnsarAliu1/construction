import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AuthFrame} from '@/components/auth/auth-frame';
import {demoMode,safeDemoEntryUrl} from '@/server/demo/policy';
import {DemoEntry} from '@/components/auth/demo-entry';

export const dynamic='force-dynamic';
export const metadata={title:'Demo | Construction',robots:{index:false,follow:false}};
export default function DemoEntryPage(){
 if(demoMode())redirect('/administrata?demo=1');
 const destination=safeDemoEntryUrl();
 if(destination)return <AuthFrame><h1 id="login-title">Demoja po përgatitet.</h1><DemoEntry/></AuthFrame>;
 return <AuthFrame><h1 id="login-title">Demoja po përgatitet.</h1><p className="login-description" role="status">Demoja nuk është e disponueshme për momentin. Ju lutem provoni përsëri më vonë.</p><Link className="demo-entry" href="/sq">Kthehu në website <span aria-hidden="true">↗</span></Link></AuthFrame>;
}
