import test from 'node:test';
import assert from 'node:assert/strict';
import {allocatePayment} from '../../src/features/payments/allocation';
import {financialProgress} from '../../src/features/projects/progress';
test('automatic payment allocation skips paid phases and fills remaining capacities exactly in phase order',()=>{
 assert.deepEqual(allocatePayment('50.00',[{id:'paid',capacity:'0.00'},{id:'first',capacity:'40.01'},{id:'second',capacity:'30.00'}]),{paid:'',first:'40.01',second:'9.99'});
});
test('automatic allocation never silently truncates excess payments or accepts incomplete/zero money',()=>{
 for(const value of ['0.00','-1.00','bad','100.01'])assert.throws(()=>allocatePayment(value,[{id:'one',capacity:'100.00'}]));
});
test('automatic allocation keeps exact cents beyond JavaScript Number precision',()=>{
 assert.deepEqual(allocatePayment('9007199254740993.01',[{id:'first',capacity:'9007199254740993.00'},{id:'second',capacity:'0.01'}]),{first:'9007199254740993.00',second:'0.01'});
});
test('financial progress is bounded visual basis points and handles zero and very large contracts',()=>{
 assert.equal(financialProgress('0.00','0.00'),0);assert.equal(financialProgress('1.00','3.00'),3333);assert.equal(financialProgress('100.00','100.00'),10000);assert.equal(financialProgress('101.00','100.00'),10000);assert.equal(financialProgress('9007199254740993.00','9007199254740993.01'),9999);
});
