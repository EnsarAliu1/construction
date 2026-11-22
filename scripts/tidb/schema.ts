import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import baseline from './migration-baseline.json';
import {tidbAuthDdl} from '../../src/server/db/tidb-auth';
import {tidbReceiptDdl} from '../../src/server/db/tidb-receipts';
import {tidbConnectionPurpose} from '../../src/server/db/tidb';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const legacyReceipts=new Set(['payment_receipts','receipt_versions','receipt_counters']);
export function buildTidbSchemaPlan(root=process.cwd()){
 const journal=JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8')) as {entries:{tag:string}[]};
 if(JSON.stringify(journal.entries.map(entry=>entry.tag))!==JSON.stringify(baseline.map(entry=>entry.tag)))throw new Error('Unreviewed migration journal; TiDB plan refused.');
 const statements:{source:string;sql:string}[]=[];
 let replacedReceiptStatements=0,omittedTriggers=0,utcDefaults=0;
 for(const migration of baseline){
  const content=readFileSync(resolve(root,'drizzle',migration.tag+'.sql'),'utf8').replaceAll('\r\n','\n');
  if(hash(content)!==migration.sha256)throw new Error('Migration checksum changed; TiDB plan refused.');
  const parts=content.split('--> statement-breakpoint').map(part=>part.trim()).filter(Boolean);
  if(parts.length!==migration.statements)throw new Error('Migration statement count mismatch.');
  for(const [index,part] of parts.entries()){
   const sql=part.replace(/^(?:\s*--[^\n]*(?:\n|$))+/,'').trim();
   if(migration.tag==='0001_wp02_history_guards'){
    if(!/^CREATE TRIGGER /i.test(sql))throw new Error('Unexpected historical guard statement.');
    omittedTriggers++;continue;
   }
   const target=/^(?:CREATE TABLE|ALTER TABLE) `([a-z0-9_]+)`/i.exec(sql)?.[1]??/^CREATE (?:UNIQUE )?INDEX `[^`]+` ON `([a-z0-9_]+)`/i.exec(sql)?.[1];
   if(target&&legacyReceipts.has(target)){replacedReceiptStatements++;continue;}
   if(/\bTRIGGER\b|`(?:payment_receipts|receipt_versions|receipt_counters)`/i.test(sql))throw new Error('Unreviewed receipt reference or unsupported guard.');
   const adapted=sql.replace(/DEFAULT \(UTC_TIMESTAMP\(3\)\)/gi,()=>{utcDefaults++;return 'DEFAULT CURRENT_TIMESTAMP(3)';});
   statements.push({source:migration.tag+':'+index,sql:adapted});
  }
 }
 if(omittedTriggers!==13||replacedReceiptStatements===0)throw new Error('Historical guard substitution was incomplete.');
 for(const [index,sql] of tidbReceiptDdl().entries())statements.push({source:'tidb_receipts_v1:'+index,sql});
 for(const [index,sql] of tidbAuthDdl().entries())statements.push({source:'tidb_auth_versions_v1:'+index,sql});
 const physicalTables=statements.map(statement=>/^CREATE TABLE `?([a-z0-9_]+)`?\s*\(/i.exec(statement.sql)?.[1]).filter((name):name is string=>!!name).sort();
 if(new Set(physicalTables).size!==physicalTables.length)throw new Error('Duplicate physical table in TiDB schema plan.');
 const fingerprint=hash(JSON.stringify({sources:baseline,statements}));
 return {version:'construction-tidb-schema/2',fingerprint,sources:baseline,statements,physicalTables,views:['payment_receipts','auth_users'],adaptations:{omittedTriggers,replacedReceiptStatements,utcDefaults}};
}
export type TidbSchemaPlan=ReturnType<typeof buildTidbSchemaPlan>;

/** Operator-only, empty-schema installer. DDL auto-commits: failed scratch schemas must be discarded. */
export async function installTidbSchema(connection:Connection,plan:TidbSchemaPlan){
 if(tidbConnectionPurpose(connection)!=='operator')throw new Error('TiDB schema installation requires an operator connection.');
 // Rebuild from the checked source; never execute a caller-supplied mutable SQL plan.
 const trusted=buildTidbSchemaPlan();
 if(plan.fingerprint!==trusted.fingerprint)throw new Error('TiDB schema fingerprint mismatch.');
 const [existing]=await connection.query<RowDataPacket[]>('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
 if(existing.length)throw new Error('TiDB schema installation requires a new empty database.');
 const [charset]=await connection.query<RowDataPacket[]>('SELECT DEFAULT_CHARACTER_SET_NAME AS charset,DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE()');
 if(charset[0]?.charset!=='utf8mb4'||charset[0]?.collation!=='utf8mb4_0900_ai_ci')throw new Error('TiDB schema charset/collation mismatch.');
 for(const statement of trusted.statements)await connection.query(statement.sql);
 await connection.query('CREATE TABLE construction_schema_manifest (id VARCHAR(64) PRIMARY KEY,plan_sha256 CHAR(64) NOT NULL,source_hashes JSON NOT NULL,installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
 await connection.execute('INSERT INTO construction_schema_manifest (id,plan_sha256,source_hashes) VALUES (?,?,?)',[trusted.version,trusted.fingerprint,JSON.stringify(trusted.sources)]);
 return {fingerprint:trusted.fingerprint,statements:trusted.statements.length};
}
