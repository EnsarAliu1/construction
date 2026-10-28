import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {paymentFixture,mysqlSkip} from "../payments/fixtures";
import {localDatabaseOptions,openLocalConnection} from "../../src/server/db/config";
import {listClients} from "../../src/features/clients/service";
import {confirmPaymentWithReceipt} from "../../src/features/receipts/service";
import {exportBusiness} from "../../src/features/reporting/export";
import {writeFile} from "node:fs/promises";

test("proposed runtime grants support real payment/receipt/export and deny DDL, account administration and history mutation",{skip:mysqlSkip,timeout:60000},async()=>{
 const evidence=process.env.AUTH_TEST_WORK_PACKAGE==='WP-15'?'artifacts/wp15':'artifacts/wp14',dbname=process.env.AUTH_TEST_WORK_PACKAGE==='WP-15'?'fitimi_test_wp15':'fitimi_test_wp14';
 const f=await paymentFixture(),db=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);
 assert.equal(db.database,dbname);assert.equal(db.port,3307);assert(["WP-14","WP-15"].includes(process.env.AUTH_TEST_WORK_PACKAGE!));
 const id=process.env.AUTH_TEST_CONTAINER_ID!;assert.match(id,/^[a-f0-9]{64}$/);
 const docker=process.env.SECURITY_DOCKER??"docker",info=spawnSync(docker,["inspect",id],{encoding:"utf8"});assert.equal(info.status,0);const own=JSON.parse(info.stdout)[0];assert.equal(own.Id,id);assert.equal(own.Config.Labels['adore.work-package'],process.env.AUTH_TEST_WORK_PACKAGE);assert.equal(own.HostConfig.PortBindings['3306/tcp'][0].HostPort,'3307');
 const name=`wp14_runtime_${randomBytes(6).toString('hex')}`,password=randomBytes(32).toString('hex');
 const admin=(sql:string)=>{const r=spawnSync(docker,['exec','-i',id,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root'],{input:sql,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Task-owned grant operation failed; SQL details withheld.');};
 const readonly=['users'],appendonly=['audit_events','entity_versions','receipt_versions'],mutable=['clients','projects','contracts','contract_phases','payments','payment_allocations','expenses','expense_categories','persons','vehicles','payment_receipts','receipt_counters','operation_requests','auth_sessions','auth_login_limits'];
 const grants=[`CREATE USER '${name}'@'%' IDENTIFIED BY '${password}'`,...readonly.map(t=>`GRANT SELECT ON fitimi_test_wp14.${t} TO '${name}'@'%'`),...appendonly.map(t=>`GRANT SELECT,INSERT ON fitimi_test_wp14.${t} TO '${name}'@'%'`),...mutable.map(t=>`GRANT SELECT,INSERT,UPDATE ON fitimi_test_wp14.${t} TO '${name}'@'%'`)];
 let runtime:Awaited<ReturnType<typeof openLocalConnection>>|undefined;
 try{
  admin(grants.join(';').replaceAll('fitimi_test_wp14',dbname)+';');runtime=await openLocalConnection({...db,user:name,password});
  const rows=await listClients(runtime,f.token);assert(rows.total>=1);const d=await f.fresh(),issued=await confirmPaymentWithReceipt(runtime,f.token,f.confirmation(d));assert(issued.documentAvailable);
  const zip=await exportBusiness(runtime,f.token,{confirmation:'export-all'});assert(zip.bytes.length>100);
  for(const sql of ["CREATE TABLE fitimi_test_wp14.wp14_forbidden (id INT)","DELETE FROM clients WHERE 1=0","UPDATE users SET status='inactive' WHERE 1=0","UPDATE audit_events SET action='tamper' WHERE 1=0","DELETE FROM entity_versions WHERE 1=0"]){await assert.rejects(runtime.query(sql.replaceAll('fitimi_test_wp14',dbname)),(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ER_TABLEACCESS_DENIED_ERROR');}
  const [actual]=await runtime.query('SHOW GRANTS');await writeFile(`${evidence}/runtime-grants.json`,JSON.stringify({grants:actual,livePaymentReceipt:true,completeZip:true,denied:['DDL','DELETE','user UPDATE','audit UPDATE','history DELETE'],productionTLS:'NOT VERIFIED'},null,2));
 }finally{await runtime?.end();admin(`DROP USER IF EXISTS '${name}'@'%';`);await f.close();}
});
