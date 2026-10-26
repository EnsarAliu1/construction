import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadLocalEnvironment } from "../src/server/db/config";
import { authenticateOperator } from "../src/server/auth/operator";
import { withAuthConnection } from "../src/server/auth/store";
import { createAccount, resetAccountPassword, revokeAccountSessions, setAccountActive } from "../src/server/auth/accounts";

function secret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Use an interactive operator terminal");
  stdout.write(prompt);
  stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error?: Error) {
      stdin.off("data", read); stdin.setRawMode(false); stdin.pause(); stdout.write("\n");
      if (error) reject(error); else resolve(value);
    }
    function read(chunk: Buffer) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") { finish(new Error("Cancelled")); return; }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    }
    stdin.on("data", read);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--help") {
    console.log("npm run accounts -- --operator <create|activate|deactivate|reset-password|revoke-sessions>\nUse a trusted local terminal. Secrets are prompted without echo; no password/key arguments are accepted.");
    return;
  }
  if (args.length !== 2 || args[0] !== "--operator" || !["create", "activate", "deactivate", "reset-password", "revoke-sessions"].includes(args[1])) throw new Error("Explicit operator command required");
  loadLocalEnvironment();
  const operator = authenticateOperator(await secret("Adore operator key: "));
  const prompt = createInterface({ input: stdin, output: stdout });
  const email = await prompt.question("Account email: ");
  const displayName = args[1] === "create" ? await prompt.question("Display name: ") : "";
  const active = args[1] === "create" && (await prompt.question("Activate now? [y/N]: ")).toLowerCase() === "y";
  prompt.close();
  let password = "";
  if (["create", "reset-password"].includes(args[1])) {
    password = await secret("New password (minimum 12 characters): ");
    if (password !== await secret("Confirm new password: ")) throw new Error("Passwords do not match");
  }
  await withAuthConnection(async connection => {
    switch (args[1]) {
      case "create": await createAccount(connection, operator, { email, displayName, password, active }); break;
      case "activate": await setAccountActive(connection, operator, email, true); break;
      case "deactivate": await setAccountActive(connection, operator, email, false); break;
      case "reset-password": await resetAccountPassword(connection, operator, email, password); break;
      case "revoke-sessions": await revokeAccountSessions(connection, operator, email); break;
    }
  });
  password = "";
  console.log("Operator action completed. A security audit event was recorded.");
}

main().catch(() => {
  console.error("Operator action failed. Verify authorization, account details, password requirements and the five-active-account limit. No secrets are displayed.");
  process.exitCode = 1;
});
