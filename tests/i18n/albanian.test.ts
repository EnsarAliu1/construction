import assert from 'node:assert/strict';
import test from 'node:test';
import {locales,isLocale} from '../../src/i18n/dictionaries';
import {valueLabel,fieldLabel,fieldValue,actionLabel} from '../../src/i18n/format';
import {historyFields} from '../../src/server/db/history-snapshot';

test('only Albanian is published; English is not an application locale',()=>{assert.deepEqual(locales,['sq']);assert(isLocale('sq'));assert(!isLocale('en'));});
test('localized presentation preserves user text and financial values',()=>{
 assert.equal(valueLabel('cash'),'Para në dorë');assert.equal(fieldValue('status','cancelled'),'Anuluar');
 assert.equal(fieldValue('description','active'),'active');assert.equal(fieldValue('name','bank'),'bank');assert.equal(fieldValue('amount','9007199254740993.01'),'9007199254740993.01');
 assert.equal(fieldValue('isActive',false),'Jo');assert.equal(fieldValue('description','<script>test</script>'),'<script>test</script>');
});
test('historical field/action presentation covers the approved schema without modifying it',()=>{
 for(const key of historyFields){assert.notEqual(fieldLabel(key),key);assert.notEqual(fieldLabel(key),'E dhënë shtesë');}
 assert.equal(actionLabel('payment_corrected'),'Pagesa u korrigjua');assert.equal(actionLabel('unknown_future_event'),'Veprim i regjistruar');
});
