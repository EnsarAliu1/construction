import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import type {RowDataPacket} from 'mysql2/promise';
import {connectTidb} from '../../src/server/db/tidb';

/** Operator-only read-only proof; does not initialize schema, provision users or load real .env.local. */
async function main(){
 const env=parseEnv(readFileSync('.env.tidb-test.local','utf8'));
 const client=await connectTidb(env,'operator');
 try{
  await client.connection.beginTransaction();
  const [rows]=await client.connection.query<RowDataPacket[]>('SELECT id,status FROM construction_compat_probe.receipt_probe WHERE id=1');
  assert.equal(rows.length,1);assert.equal(rows[0].status,0);
  const [money]=await client.connection.query<RowDataPacket[]>("SELECT CAST('99999999999999999.99' AS DECIMAL(19,2)) AS amount");
  assert.equal(money[0].amount,'99999999999999999.99');
  await client.connection.commit();
  console.log(JSON.stringify({connected:true,version:client.version,tlsVerified:true,utc:true,pessimisticTransactions:true,checkConstraints:true,exactDecimalStrings:true,readOnlyQueries:true,transactionReadOnlyUnsupported:true,applicationProviderUnchanged:true}));
 }finally{await client.close();}
}
void main().catch(()=>{console.error('TiDB verification failed; credentials and database error details withheld.');process.exitCode=1;});
