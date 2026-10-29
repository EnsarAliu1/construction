import assert from "node:assert/strict";
import test from "node:test";
import { assertSupportedMySql, localDatabaseOptions, loadLocalEnvironment } from "../../src/server/db/config";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { eurDecimal } from "../../src/server/db/money";

const fixtureUrl = "mysql://synthetic:fixture-only@127.0.0.1:3307/fitimi_test_unit";

test("CLI environment priority matches development, test and production without replacing explicit values", () => {
  const environment:Record<string,string|undefined>=process.env;
  const directory=mkdtempSync(join(tmpdir(),"fitimi-env-priority-"));
  const previousDirectory=process.cwd(),previousMode=process.env.NODE_ENV,previousValue=process.env.FITIMI_ENV_PRIORITY_TEST;
  try {
    process.chdir(directory);
    for(const [file,value] of [[".env","base"],[".env.local","owner"],[".env.development.local","development"],[".env.production","production"]])writeFileSync(file,`FITIMI_ENV_PRIORITY_TEST=${value}\n`);
    for(const [mode,expected] of [["development","development"],["production","owner"],["test","base"]]){
      environment.NODE_ENV=mode;delete process.env.FITIMI_ENV_PRIORITY_TEST;loadLocalEnvironment();
      assert.equal(process.env.FITIMI_ENV_PRIORITY_TEST,expected);
    }
    environment.NODE_ENV="development";process.env.FITIMI_ENV_PRIORITY_TEST="explicit";loadLocalEnvironment();
    assert.equal(process.env.FITIMI_ENV_PRIORITY_TEST,"explicit");
  } finally {
    process.chdir(previousDirectory);
    if(previousMode===undefined)delete environment.NODE_ENV;else environment.NODE_ENV=previousMode;
    if(previousValue===undefined)delete process.env.FITIMI_ENV_PRIORITY_TEST;else process.env.FITIMI_ENV_PRIORITY_TEST=previousValue;
    assert.equal(resolve(directory,".."),resolve(tmpdir()));assert(basename(directory).startsWith("fitimi-env-priority-"));
    rmSync(directory,{recursive:true,force:true});
  }
});

test("local database guard requires opt-in, loopback, MySQL protocol and disposable names", () => {
  for (const value of [
    "mysql://u:p@example.com/fitimi_test_unit",
    "mysql://u:p@127.0.0.1/customer_database",
    "mysql://u:p@127.0.0.1/fitimi_dev_unit",
    "mysql://u:p@127.0.0.1/fitimi_test_unit?host=example.com",
    "mysql://u:p@127.0.0.1/fitimi_test_unit#fragment",
    "postgres://u:p@127.0.0.1/fitimi_test_unit",
    "invalid value containing credentials",
  ]) assert.throws(() => localDatabaseOptions(value, "test", "1"));
  assert.throws(() => localDatabaseOptions(fixtureUrl, "test", "0"));
  assert.throws(() => localDatabaseOptions(undefined, "test", "1"));
});

test("driver settings preserve decimals and dates and prevent multi-statement execution", () => {
  const settings = localDatabaseOptions(fixtureUrl, "test", "1");
  assert.equal(settings.port, 3307);
  assert.equal(settings.database, "fitimi_test_unit");
  assert.equal(settings.decimalNumbers, false);
  assert.equal(settings.bigNumberStrings, true);
  assert.equal(settings.dateStrings, true);
  assert.equal(settings.timezone, "Z");
  assert.equal(settings.multipleStatements, false);
});

test("database configuration errors do not echo secrets", () => {
  try { localDatabaseOptions("mysql://private:secretvalue@external.example/real", "test", "1"); }
  catch (error) { assert.doesNotMatch(String(error), /secretvalue|private|external\.example/); }
});

test("target version rejects MariaDB and unverified MySQL versions", () => {
  assert.doesNotThrow(() => assertSupportedMySql("8.4.9"));
  for (const version of ["10.4.32-MariaDB", "8.0.43", "9.0.0"]) assert.throws(() => assertSupportedMySql(version));
});

test("EUR serialization keeps exact strings, including amounts beyond JavaScript safe integer precision", () => {
  for (const value of ["0.00", "0.10", "9007199254740993.01", "99999999999999999.99"]) assert.equal(eurDecimal(value), value);
  for (const value of ["0.1", "0.001", "1e3", "-1.00", "01.00", "100000000000000000.00", "NaN"]) assert.throws(() => eurDecimal(value));
});
