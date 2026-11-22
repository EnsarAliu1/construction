import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
const env={...process.env};
for(const file of ['.env','.env.local','.env.production','.env.production.local','.env.development.local'])if(existsSync(file))for(const key of Object.keys(parseEnv(readFileSync(file,'utf8'))))env[key]='';
Object.assign(env,parseEnv(readFileSync('.env.demo-cloud.local','utf8')),{NODE_ENV:'production',VERCEL:'1',FITIMI_TEST_BUILD:'cloud-demo',AUTH_ORIGIN:'http://localhost:3110',NEXT_TELEMETRY_DISABLED:'1'});
const run=args=>new Promise((yes,no)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});child.once('error',no);child.once('exit',code=>code===0?yes():no(new Error('Owned demo build/test process failed.')));});
await run(['node_modules/next/dist/bin/next','build']);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3110'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';for(const output of [server.stdout,server.stderr])output.on('data',chunk=>logs=(logs+String(chunk)).slice(-50000));
try{
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch(env.AUTH_ORIGIN+'/api/demo/ready')).status===200){ready=true;break;}}catch{}await pause(500);}assert(ready);
 await run(['--conditions=react-server','--import','tsx','scripts/demo/cloud-verify.ts']);
}finally{if(server.exitCode===null){const stopped=new Promise(done=>server.once('exit',done));server.kill();await stopped;}console.log(JSON.stringify({ownedDemoTestServerStopped:true,unexpectedSqlCodes:[...new Set(logs.match(/ER_[A-Z_]+/g)??[])]}));}
