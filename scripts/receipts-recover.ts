import {stdin,stdout} from "node:process";
import {loadLocalEnvironment} from "../src/server/db/config";
import {authenticateOperator} from "../src/server/auth/operator";
import {withAuthConnection} from "../src/server/auth/store";
import {recoverReceiptFiles} from "../src/features/receipts/service";
async function key(){
  if(!stdin.isTTY||!stdin.setRawMode)throw new Error("Use an interactive operator terminal.");
  stdout.write("Adore operator key: ");stdin.setRawMode(true);stdin.resume();
  return new Promise<string>((resolve,reject)=>{let value="";const done=(error?:Error)=>{stdin.off("data",read);stdin.setRawMode(false);stdin.pause();stdout.write("\n");if(error)reject(error);else resolve(value);};const read=(chunk:Buffer)=>{for(const ch of chunk.toString("utf8")){if(ch==="\u0003"){done(new Error("Cancelled"));return;}if(ch==="\r"||ch==="\n"){done();return;}if(ch==="\u007f"||ch==="\b")value=value.slice(0,-1);else if(ch>=" ")value+=ch;}};stdin.on("data",read);});
}
async function main(){
  const args=process.argv.slice(2);if(args[0]!=="--operator"||args.length>2)throw new Error("Use receipts:recover -- --operator [last-cursor]");
  loadLocalEnvironment();const operator=authenticateOperator(await key());const result=await withAuthConnection(c=>recoverReceiptFiles(c,operator,args[1]??""));
  console.log(JSON.stringify(result));console.log("Recovery checked at most 100 owned journals. Referenced documents were preserved. Repeat with cursor for the next batch.");
}
void main().catch(()=>{console.error("Receipt recovery failed. No sensitive details displayed. Resolve database/storage availability and retry; never delete issued PDFs manually.");process.exitCode=1;});
