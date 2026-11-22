import assert from 'node:assert/strict';
import test from 'node:test';
import {authenticationVersion} from '../../src/server/auth/user-version';
test('authentication generations normalize exact unsigned integers and reject malformed or overflowing values',()=>{
 for(const value of [1,'1',4294967295,'4294967295'])assert.equal(authenticationVersion(value),Number(value));
 for(const value of [undefined,null,0,-1,1.1,'','1.0','1e2',' 2 ','99999999999',4294967296,NaN,Infinity,{}])assert.throws(()=>authenticationVersion(value),/Invalid authentication generation/);
});
