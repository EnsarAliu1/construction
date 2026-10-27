import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {join} from "node:path";
const run=promisify(execFile),secured=new Set<string>();
/** Windows chmod alone does not set an NTFS DACL. Restrict inherited workspace grants. */
export async function secureWindowsReceiptDirectory(root:string,owner:string){
  if(process.platform!=="win32"||secured.has(`${root}|${owner}`))return;
  const system=join(/* turbopackIgnore: true */ process.env.SystemRoot??"C:\\Windows","System32");
  try{
    const identity=await run(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ system,"whoami.exe"),["/user","/fo","csv","/nh"],{windowsHide:true,maxBuffer:16384});
    const sid=/S-\d(?:-\d+)+/.exec(identity.stdout)?.[0];if(!sid)throw new Error();
    await run(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ system,"icacls.exe"),[root,"/inheritance:r","/grant:r",`*${sid}:(OI)(CI)F`,"*S-1-5-18:(OI)(CI)F","*S-1-5-32-544:(OI)(CI)F"],{windowsHide:true,maxBuffer:16384});
    secured.add(`${root}|${owner}`);
  }catch{throw new Error("Private receipt directory permissions could not be secured.");}
}
