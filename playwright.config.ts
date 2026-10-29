import {defineConfig} from "@playwright/test";
import {mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,unlinkSync} from "node:fs";
import {resolve,join} from "node:path";
// OneDrive's Dirent may call a hydrated regular file a symlink. Playwright skips
// such entries. Stage byte-identical specs using lstat; never use a personal profile.
const staged="artifacts/browser/specs";
mkdirSync(staged,{recursive:true});
for(const name of readdirSync(staged))if(name.endsWith(".spec.ts")&&lstatSync(join(staged,name)).isFile())unlinkSync(join(staged,name));
for(const name of readdirSync("tests/website/browser")){
 const source=join("tests/website/browser",name);
 if(name.endsWith(".spec.ts")&&lstatSync(source).isFile()&&!lstatSync(source).isSymbolicLink())writeFileSync(join(staged,name),readFileSync(source));
}
const results=process.env.FITIMI_TEST_BUILD==="sq"?"artifacts/sq/browser-results":process.env.FITIMI_TEST_BUILD==="wp16"?"artifacts/wp16/browser-results":process.env.FITIMI_TEST_BUILD==="wp15"?"artifacts/wp15/browser-results":process.env.FITIMI_TEST_BUILD==="wp14"?"artifacts/wp14/browser-results":process.env.FITIMI_TEST_BUILD==="wp13"?"artifacts/wp13/browser-results":"artifacts/wp11/browser-results";
const target=new URL(process.env.AUTH_ORIGIN??"http://127.0.0.1:3000");
if(!["127.0.0.1","localhost","[::1]"].includes(target.hostname)||target.username||target.password||target.pathname!=="/"||target.search||target.hash)throw new Error("Browser verification requires an isolated loopback origin.");
export default defineConfig({testDir:resolve(staged),testMatch:"*.spec.ts",outputDir:results,fullyParallel:false,workers:1,retries:0,timeout:45000,reporter:[["list"],["json",{outputFile:`${results}/results.json`}]],use:{baseURL:target.origin,browserName:"chromium",channel:"msedge",headless:true,viewport:{width:1440,height:1000},colorScheme:"light",locale:"en-GB",screenshot:"only-on-failure",trace:"retain-on-failure"}});
