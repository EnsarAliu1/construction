import assert from 'node:assert/strict';
import test from 'node:test';
import {readJsonObject} from '../../src/server/security/request-body';

const request=(body:string|Uint8Array,headers:Record<string,string>={})=>new Request('http://localhost/api/test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:body as BodyInit});
test('JSON boundary preserves Albanian text, exact money strings and valid UTF-8 media types',async()=>{
 const value={name:'Çlirim Ëndrra',amount:'9007199254740993.01'};
 assert.deepEqual(await readJsonObject(request(JSON.stringify(value),{'Content-Type':'Application/JSON; charset=utf-8'})),value);
});
test('JSON boundary rejects MIME lookalikes, invalid encoding and non-object bodies without echoing inputs',async()=>{
 for(const r of [request('{}',{'Content-Type':'application/jsonp'}),request('{}',{'Content-Type':'text/plain'}),request(new Uint8Array([123,34,120,34,58,34,0xc3,0x28,34,125])),...['null','[]','42','"private-sentinel"','{"private-sentinel":'].map(v=>request(v))]){
  await assert.rejects(readJsonObject(r),error=>error instanceof Error&&!error.message.includes('private-sentinel'));
 }
});
test('JSON boundary enforces actual bytes for chunked bodies and cancels oversized streams',async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(Buffer.from('{"name":"'));c.enqueue(Buffer.from('ë'.repeat(20)));},cancel(){cancelled=true;}});
 const r=new Request('http://localhost/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'} as RequestInit);
 await assert.rejects(readJsonObject(r,32));assert(cancelled);assert.equal(body.locked,false);
 await assert.rejects(readJsonObject(request('{}',{'Content-Length':'10000'}),32));
});
test('JSON boundary stops stalled uploads and releases the reader instead of occupying a request forever',async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(Buffer.from('{'));},cancel(){cancelled=true;}});
 const r=new Request('http://localhost/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'} as RequestInit);
 await assert.rejects(readJsonObject(r,32,30));assert(cancelled);assert.equal(body.locked,false);
});
