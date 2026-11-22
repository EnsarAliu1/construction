/** Server-owned SQL capabilities. No schema/table/privilege comes from an HTTP request. */
export const tidbReportingTables=['clients','projects','contracts','contract_phases','payments','payment_allocations','expenses','expense_categories','persons','vehicles','payment_receipts','payment_receipt_identities','payment_receipt_states','receipt_versions','audit_events','entity_versions','users'] as const;
const mutable=['clients','projects','contracts','contract_phases','payments','payment_allocations','expenses','expense_categories','persons','vehicles','receipt_counters','operation_requests','auth_sessions','auth_login_limits','auth_mfa_factors','auth_mfa_challenges','auth_mfa_recovery_codes','auth_passkeys','auth_passkey_challenges'];
const appendOnly=['auth_user_versions','audit_events','entity_versions','receipt_versions','payment_receipt_identities','payment_receipt_states'];
export type TidbPrivilege='SELECT'|'INSERT'|'UPDATE'|'DELETE';
export type TidbGrantProfile='runtime'|'reporting'|'demo';
export function tidbPrivilegeProfile(profile:TidbGrantProfile):Record<string,readonly TidbPrivilege[]>{
 if(profile==='reporting')return Object.fromEntries(tidbReportingTables.map(table=>[table,['SELECT']]));
 if(profile!=='runtime'&&profile!=='demo')throw new Error('Unrecognized TiDB grant profile.');
 const result:Record<string,TidbPrivilege[]>={construction_schema_manifest:['SELECT'],users:['SELECT'],auth_users:['SELECT'],auth_account_control:['SELECT'],payment_receipts:['SELECT']};
 for(const table of appendOnly)result[table]=['SELECT','INSERT'];
 for(const table of mutable)result[table]=['SELECT','INSERT','UPDATE'];
 if(profile==='demo'){result.demo_pdf_owner=['SELECT'];result.demo_pdf_files=['SELECT','INSERT'];result.demo_pdf_chunks=['SELECT','INSERT'];}
 result.auth_passkey_challenges.push('DELETE');
 // Column grants are not usable on the tested Cloud engine. Never widen users to table UPDATE.
 return result;
}
export function tidbGrantStatements(database:string,profile:TidbGrantProfile){
 if(!/^[a-z][a-z0-9_]{0,63}$/i.test(database))throw new Error('Invalid TiDB schema identifier.');
 return Object.entries(tidbPrivilegeProfile(profile)).map(([table,privileges])=>`GRANT ${privileges.join(',')} ON \`${database}\`.\`${table}\` TO ?@?`);
}

/** Strict direct-grant audit: roles, wildcard scopes and administrative capabilities fail closed. */
export function grantsMatchTidbProfile(grants:unknown[],database:string,profile:TidbGrantProfile,complete=true){
 if(!/^[a-z][a-z0-9_]{0,63}$/i.test(database)||grants.length===0)return false;
 const policy=tidbPrivilegeProfile(profile),seen=new Set<string>();
 for(const grant of grants){
  if(typeof grant!=='string')return false;
  if(/^GRANT USAGE ON \*\.\* TO (?:'[^']+'|`[^`]+`)@(?:'[^']+'|`[^`]+`)$/i.test(grant))continue;
  const match=/^GRANT ([A-Z, ]+) ON `([a-z0-9_]+)`\.`([a-z0-9_]+)` TO (?:'[^']+'|`[^`]+`)@(?:'[^']+'|`[^`]+`)$/i.exec(grant);
  if(!match||match[2]!==database||!Object.hasOwn(policy,match[3]))return false;
  for(const raw of match[1].split(',')){
   const privilege=raw.trim().toUpperCase() as TidbPrivilege;
   if(!policy[match[3]].includes(privilege))return false;
   seen.add(match[3]+':'+privilege);
  }
 }
 return seen.size>0&&(!complete||Object.entries(policy).every(([table,privileges])=>privileges.every(privilege=>seen.has(table+':'+privilege))));
}
export const tidbActivationBlockers=['serverless_isolated_visitor_demo_pending','verified_backup_and_restore_pending','reviewed_real_data_migration_pending'] as const;
