import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {initializeCloudDemo,warmCloudDemo,cleanupCloudDemo} from '../../src/server/demo/cloud-runtime';
import {cloudDemoEnvironment} from '../../src/server/demo/cloud-policy';
import {connectTidb} from '../../src/server/db/tidb';
async function main(){
 const path='.env.demo-cloud.local',operator=parseEnv(readFileSync('.env.demo-tidb.local','utf8')),main=parseEnv(readFileSync('.env.tidb-test.local','utf8'));
 assert(operator.DB_USERNAME&&operator.DB_HOST&&main.DB_USERNAME);
 assert.notEqual(operator.DB_USERNAME.split('.')[0],main.DB_USERNAME.split('.')[0]);
 if(!existsSync(path)){
  const env={DEMO_MODE:'1',DATABASE_PROVIDER:'tidb-demo',DEMO_DB_HOST:operator.DB_HOST,DEMO_DB_PORT:operator.DB_PORT,DEMO_DB_USERNAME:operator.DB_USERNAME,DEMO_DB_PASSWORD:operator.DB_PASSWORD,DEMO_TIDB_PIN:createHash('sha256').update(operator.DB_HOST.toLowerCase()+'|'+operator.DB_USERNAME.split('.')[0]).digest('hex'),DEMO_PRIVATE_KEY:randomBytes(32).toString('hex'),DATABASE_URL:'',ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEYS:'',MFA_ENCRYPTION_KEY_ID:'',DB_PASSWORD:'',BLOB_READ_WRITE_TOKEN:'',AUTH_ORIGIN:'http://localhost:3110',RECEIPT_NUMBER_PREFIX:'DEMO',PUBLIC_SITE_INDEXING:'0',NEXT_TELEMETRY_DISABLED:'1'};
  writeFileSync(path,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx',mode:0o600});
 }
 Object.assign(process.env,parseEnv(readFileSync(path,'utf8')));
 await initializeCloudDemo();await cleanupCloudDemo();
 for(let i=0;i<2;i++){console.log(JSON.stringify({preparingDemoWorkspace:i+1,isolatedInstance:true}));await warmCloudDemo();}
 const source=await connectTidb(cloudDemoEnvironment(),'operator');try{const [rows]=await source.connection.query('SELECT COUNT(*) AS total,SUM(ready) AS prepared FROM demo_sessions');console.log(JSON.stringify({cloudDemoPrepared:true,counts:rows,realDataUnchanged:true,credentialsWithheld:true}));}finally{await source.close();}
}
void main().catch(error=>{console.error(JSON.stringify({cloudDemoPrepared:false,errorType:error?.name,code:error?.code,location:error?.stack?.match(/(?:cloud-runtime|cloud-policy|cloud)\.ts:\d+:\d+/g),credentialsWithheld:true}));process.exitCode=1;});
