import {writeFileSync} from 'node:fs';
import {buildTidbSchemaPlan} from './schema';
import {tidbPrivilegeProfile,tidbActivationBlockers} from '../../src/server/db/tidb-privileges';
const plan=buildTidbSchemaPlan();
const report={version:plan.version,fingerprint:plan.fingerprint,sources:plan.sources,sqlStatements:plan.statements.length,physicalTables:plan.physicalTables,views:plan.views,adaptations:plan.adaptations,profiles:{runtime:tidbPrivilegeProfile('runtime'),reporting:tidbPrivilegeProfile('reporting')},activationAllowed:false,blockers:tidbActivationBlockers};
writeFileSync('docs/tidb-schema-plan.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({schemaPlanWritten:true,statements:plan.statements.length,tables:plan.physicalTables.length,activationAllowed:false,containsCredentials:false}));
