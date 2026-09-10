import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { scryptSync } from "node:crypto";
import { parseEnv } from "node:util";

test("bootstrap creates usable random credentials without plaintext password in .env", () => {
  const generate = () => {
    const result = spawnSync(
      process.execPath,
      [new URL("../scripts/container-env.mjs", import.meta.url).pathname],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    return {
      config: parseEnv(result.stdout),
      credentials: result.stderr,
      env: result.stdout,
    };
  };
  const first = generate();
  const second = generate();
  const password = first.credentials.match(/管理员初始密码：(.*)/)[1];
  const [algorithm, salt, digest] = first.config.ADMIN_PASSWORD_HASH.split(":");
  assert.equal(algorithm, "scrypt");
  assert.equal(scryptSync(password, salt, 64).toString("hex"), digest);
  assert.match(first.config.POSTGRES_PASSWORD, /^[a-f0-9]{48}$/);
  assert.match(first.config.RATE_LIMIT_SECRET, /^[a-f0-9]{64}$/);
  assert.equal(first.config.APP_URL, "http://localhost:3000");
  assert.equal(first.config.TRUST_PROXY, "false");
  assert.equal(
    new URL(first.config.DATABASE_URL).password,
    first.config.POSTGRES_PASSWORD,
  );
  assert.ok(!first.env.includes(password));
  for (const key of [
    "POSTGRES_PASSWORD",
    "ADMIN_PASSWORD_HASH",
    "RATE_LIMIT_SECRET",
  ]) {
    assert.notEqual(first.config[key], second.config[key]);
  }
});
