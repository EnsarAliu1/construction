import { resetMfa } from "../src/server/auth/mfa";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadLocalEnvironment } from "../src/server/db/config";
import { authenticateOperator } from "../src/server/auth/operator";
import { withAuthConnection } from "../src/server/auth/store";
import { createAccount, resetAccountPassword, revokeAccountSessions, setAccountActive } from "../src/server/auth/accounts";
function secret(prompt: string): Promise<string> {
    if (!stdin.isTTY || !stdin.setRawMode)
        throw new Error("Përdorni terminal ndërveprues të operatorit");
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    return new Promise((resolve, reject) => {
        let value = "";
        function finish(error?: Error) {
            stdin.off("data", read);
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write("\n");
            if (error)
                reject(error);
            else
                resolve(value);
        }
        function read(chunk: Buffer) {
            for (const character of chunk.toString("utf8")) {
                if (character === "\u0003") {
                    finish(new Error("Anuluar"));
                    return;
                }
                if (character === "\r" || character === "\n") {
                    finish();
                    return;
                }
                if (character === "\u007f" || character === "\b")
                    value = value.slice(0, -1);
                else if (character >= " ")
                    value += character;
            }
        }
        stdin.on("data", read);
    });
}
async function main() {
    const args = process.argv.slice(2);
    if (args[0] === "--help") {
        console.log("npm run accounts -- --operator <create|activate|deactivate|reset-password|revoke-sessions|reset-mfa>\nPërdorni terminal lokal të besuar. Sekretet kërkohen pa u shfaqur; fjalëkalimet dhe çelësat nuk pranohen si argumente.");
        return;
    }
    if (args.length !== 2 || args[0] !== "--operator" || !["create", "activate", "deactivate", "reset-password", "revoke-sessions", "reset-mfa"].includes(args[1]))
        throw new Error("Kërkohet komandë e qartë e operatorit");
    loadLocalEnvironment();
    const operator = authenticateOperator(await secret("Çelësi i operatorit Adore: "));
    const prompt = createInterface({ input: stdin, output: stdout });
    const email = await prompt.question("Emaili i llogarisë: ");
    const displayName = args[1] === "create" ? await prompt.question("Emri i përdoruesit: ") : "";
    const active = args[1] === "create" && (await prompt.question("Të aktivizohet tani? [p/J]: ")).toLowerCase() === "p";
    const recoveryReasons:Record<string,string>={"1":"lost-authenticator-and-codes","2":"suspected-factor-compromise","3":"verified-device-replacement","4":"verified-disaster-recovery"};
    const mfaReason = args[1] === "reset-mfa" ? recoveryReasons[await prompt.question("Arsyeja e rikuperimit (1: humbje e pajisjes dhe kodeve; 2: dyshim për komprometim; 3: zëvendësim i verifikuar i pajisjes; 4: rikuperim i verifikuar pas incidentit): ")]??"" : "";
    const mfaIdentity = args[1] === "reset-mfa" && (await prompt.question("A është verifikuar identiteti në mënyrë të pavarur sipas procedurës së miratuar? [p/J]: ")).toLowerCase() === "p";
    const mfaConfirmation = args[1] === "reset-mfa" ? await prompt.question(`Shkruani reset-mfa ${email} për të zhvlerësuar të gjithë faktorët, kodet dhe sesionet: `) : "";
    prompt.close();
    let password = "";
    if (["create", "reset-password"].includes(args[1]) || args[1] === "reset-mfa" && mfaReason === "verified-disaster-recovery") {
        password = await secret("Fjalëkalimi i ri (të paktën 12 karaktere): ");
        if (password !== await secret("Konfirmoni fjalëkalimin e ri: "))
            throw new Error("Fjalëkalimet nuk përputhen");
    }
    await withAuthConnection(async (connection) => {
        switch (args[1]) {
            case "create":
                await createAccount(connection, operator, { email, displayName, password, active });
                break;
            case "activate":
                await setAccountActive(connection, operator, email, true);
                break;
            case "deactivate":
                await setAccountActive(connection, operator, email, false);
                break;
            case "reset-password":
                await resetAccountPassword(connection, operator, email, password);
                break;
            case "reset-mfa":
                if (mfaConfirmation !== `reset-mfa ${email}`)
                    throw new Error("Kërkohet konfirmim i qartë i llogarisë së synuar");
                await resetMfa(connection, operator, email, { reason: mfaReason, identityVerified: mfaIdentity, confirmation: "reset-mfa", ...(mfaReason === "verified-disaster-recovery" ? { newPassword: password } : {}) });
                break;
            case "revoke-sessions":
                await revokeAccountSessions(connection, operator, email);
                break;
        }
    });
    password = "";
    console.log("Veprimi i operatorit përfundoi. U regjistrua veprimi në historikun e sigurisë.");
}
main().catch(() => {
    console.error("Veprimi i operatorit dështoi. Kontrolloni autorizimin, të dhënat e llogarisë, kërkesat e fjalëkalimit dhe kufirin prej pesë llogarish aktive. Sekretet nuk shfaqen.");
    process.exitCode = 1;
});
