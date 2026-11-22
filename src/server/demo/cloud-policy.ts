import {createHash,createHmac} from 'node:crypto';
import {tidbOptions} from '../db/tidb';
import {demoDatabase,demoMode,demoPassword} from './policy';
export const CLOUD_DEMO_CONTROL='construction_demo_control';
export function cloudDemoMode(){return demoMode()&&process.env.DATABASE_PROVIDER==='tidb-demo';}
export function cloudDemoEnvironment(){
 if(!cloudDemoMode()||process.env.DATABASE_URL||process.env.ADORE_OPERATOR_KEY||process.env.MFA_ENCRYPTION_KEYS||process.env.DB_PASSWORD||process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Dedicated Cloud demo environment required.');
 demoPassword('fitimi_demo_'+'0'.repeat(24));
 const env={DB_HOST:process.env.DEMO_DB_HOST,DB_PORT:process.env.DEMO_DB_PORT,DB_USERNAME:process.env.DEMO_DB_USERNAME,DB_PASSWORD:process.env.DEMO_DB_PASSWORD,DB_DATABASE:CLOUD_DEMO_CONTROL};
 const options=tidbOptions(env,'operator');
 const pin=createHash('sha256').update(options.host+'|'+String(options.user).split('.')[0]).digest('hex');
 if(!process.env.DEMO_TIDB_PIN||pin!==process.env.DEMO_TIDB_PIN)throw new Error('Demo instance identity mismatch.');
 return env;
}
export function cloudDemoUser(database:string,reader=false){
 const env=cloudDemoEnvironment();return String(env.DB_USERNAME).split('.')[0]+'.'+(reader?'r_':'d_')+demoDatabase(database).slice(-8);
}
export function cloudDemoPassword(database:string,reader=false){return createHmac('sha256',process.env.DEMO_PRIVATE_KEY!).update((reader?'reader:':'visitor:')+demoDatabase(database)).digest('hex');}
export function cloudDemoRuntimeEnvironment(database:string){return {...cloudDemoEnvironment(),DB_DATABASE:demoDatabase(database),DB_USERNAME:cloudDemoUser(database),DB_PASSWORD:cloudDemoPassword(database),DB_REPORT_USERNAME:cloudDemoUser(database,true),DB_REPORT_PASSWORD:cloudDemoPassword(database,true)};}
export function cloudDemoOwner(identity:string){const h=createHash('sha256').update('construction-demo-sql/1|'+identity).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
export function cloudDemoInstallation(){return createHash('sha256').update('construction-demo-control/1|'+process.env.DEMO_PRIVATE_KEY).digest('hex');}
export const cloudDemoPdfDdl=[
 'CREATE TABLE demo_pdf_owner (id INT PRIMARY KEY, owner_id CHAR(36) NOT NULL, database_identity VARCHAR(80) NOT NULL)',
 'CREATE TABLE demo_pdf_files (id CHAR(36) PRIMARY KEY, sha256 CHAR(64) NOT NULL, byte_length INT UNSIGNED NOT NULL, chunks INT UNSIGNED NOT NULL, CHECK (byte_length>=100 AND byte_length<=8388608) ENFORCED, CHECK (chunks>=1 AND chunks<=16) ENFORCED)',
 'CREATE TABLE demo_pdf_chunks (file_id CHAR(36) NOT NULL, part INT UNSIGNED NOT NULL, bytes MEDIUMBLOB NOT NULL, PRIMARY KEY(file_id,part), FOREIGN KEY(file_id) REFERENCES demo_pdf_files(id) ON DELETE RESTRICT)'
] as const;
