import {spawnSync,type ChildProcess} from 'node:child_process';

/** Only accepts a child handle created by this launcher; never discovers/kills unrelated servers. */
export function stopOwnedProcess(child:ChildProcess|undefined){
 if(!child?.pid||child.exitCode!==null)return;
 if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 else child.kill();
}
