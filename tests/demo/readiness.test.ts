import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import test from 'node:test';
import {probeDemo} from '../../src/server/demo/readiness';

test('demo readiness rejects offline, invalid and redirecting services before accepting a healthy demo',async()=>{
 let mode='unavailable',requests=0;
 const server=createServer((request,response)=>{
  requests++;assert.equal(request.url,'/api/demo/ready');assert.equal(request.headers.cookie,undefined);
  if(mode==='unavailable'){response.writeHead(503);response.end('{}');}
  else if(mode==='redirect'){response.writeHead(302,{Location:'/unexpected'});response.end();}
  else if(mode==='invalid'){response.end(JSON.stringify({ready:true,service:'other-app'}));}
  else if(mode==='malformed'){response.end('not JSON');}
  else if(mode==='oversize'){response.end('x'.repeat(2048));}
  else response.end(JSON.stringify({ready:true,service:'construction-demo-v1'}));
 });
 await new Promise<void>(yes=>server.listen(0,'127.0.0.1',yes));const address=server.address();assert(address&&typeof address==='object');const origin=`http://127.0.0.1:${address.port}`;
 try{
  for(const state of ['unavailable','redirect','invalid','malformed','oversize']){mode=state;assert.equal(await probeDemo(origin+'/administrata?demo=1'),false);}
  mode='ready';assert.equal(await probeDemo(origin+'/administrata?demo=1'),true);assert.equal(requests,6);
 }finally{server.closeAllConnections();await new Promise<void>(yes=>server.close(()=>yes()));}
 assert.equal(await probeDemo(origin+'/administrata?demo=1'),false);
});
