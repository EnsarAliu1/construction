import { hash, verify, type Options } from "@node-rs/argon2";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

// Algorithm 2 is Argon2id; the package's ambient const enum cannot be imported
// as a runtime value with Next.js isolatedModules enabled.
const options: Options = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
let dummyHash: Promise<string> | undefined;
let common:Set<string>|undefined;
function commonPasswords(){common??=new Set(readFileSync(resolve('assets/security/common-passwords.txt'),'utf8').split(/\r?\n/).map(p=>p.trim().toLowerCase()).filter(Boolean));if(common.size<3000)throw new Error('Password screening data unavailable.');return common;}

export function hashPassword(password: string) {
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 1024) throw new Error("Use a password of at least 12 characters and at most 1024 bytes");
  if(commonPasswords().has(password.trim().toLowerCase()))throw new Error('Choose a password outside the common-password list.');
  return hash(password, options);
}

export async function verifyPassword(password: string, encodedHash: string | undefined) {
  dummyHash ??= hash("Non-account timing equalizer; never a seeded credential", options);
  const target = encodedHash?.startsWith("$argon2id$") ? encodedHash : await dummyHash;
  try {
    const valid = await verify(target, password, options);
    return Boolean(encodedHash?.startsWith("$argon2id$") && valid);
  } catch { return false; }
}
