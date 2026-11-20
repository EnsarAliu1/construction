import {authJson} from '@/server/auth/http';
import {safeDemoEntryUrl,demoMode} from '@/server/demo/policy';
import {probeDemo} from '@/server/demo/readiness';

export const runtime='nodejs';
export async function GET(){
 if(demoMode())return authJson({ready:false},404);
 const destination=safeDemoEntryUrl();
 if(!destination)return authJson({ready:false});
 return authJson(await probeDemo(destination)?{ready:true,url:destination}:{ready:false});
}
