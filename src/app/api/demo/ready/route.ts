import {authJson} from '@/server/auth/http';
import {demoMode} from '@/server/demo/policy';
import {demoReady} from '@/server/demo/runtime';

export const runtime='nodejs';
export async function GET(){
 if(!demoMode())return authJson({ready:false},404);
 try{await demoReady();return authJson({ready:true,service:'construction-demo-v1'});}catch{return authJson({ready:false},503);}
}
