import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const engineMock = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DATABASE_TEST_LOG"
case "$*" in
  *'pg_dump '*) printf 'test archive bytes'; [[ "$DATABASE_TEST_CASE" != dump-failure ]] ;;
  *'pg_restore --list'*) cat >/dev/null; [[ "$DATABASE_TEST_CASE" != archive-failure ]] ;;
  *'pg_restore -U '*) cat >/dev/null; [[ "$DATABASE_TEST_CASE" != restore-failure ]] ;;
  *'psql '*) if [[ "$DATABASE_TEST_CASE" == nonempty ]]; then printf '1\\n'; else printf '0\\n'; fi ;;
  *'ps -q') printf 'test-db\\ntest-web\\n' ;;
  'inspect '*test-web) printf 'web\\n' ;;
  'inspect '*test-db) printf 'db\\n' ;;
  *) exit 0 ;;
esac
`;
const digest = (value) => createHash("sha256").update(value).digest("hex");

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "ai-database-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    for (const file of [
      "deploy.sh",
      "scripts/deploy.sh",
      "scripts/database.sh",
    ]) {
      copyFileSync(new URL(`../${file}`, import.meta.url), join(root, file));
    }
    writeFileSync(join(root, ".env"), "TEST_ONLY=preserved\n");
    writeFileSync(join(root, "compose.yaml"), "services: {}\n");
    writeFileSync(join(root, "bin/podman"), engineMock, { mode: 0o755 });
    const input = join(root, "input backup");
    mkdirSync(input);
    for (const [name, data] of Object.entries({
      "database.dump": "test archive bytes",
      ".env": "TEST_ONLY=old-backup\n",
    })) {
      writeFileSync(join(input, name), data);
      writeFileSync(join(input, `${name}.sha256`), digest(data));
    }
    const log = join(root, "calls.log");
    const run = (action, scenario = "success", extra = []) => {
      writeFileSync(log, "");
      const result = spawnSync(
        "bash",
        ["deploy.sh", "podman", action, ...extra],
        {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${join(root, "bin")}:${process.env.PATH}`,
            DATABASE_TEST_CASE: scenario,
            DATABASE_TEST_LOG: log,
          },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      assert.ifError(result.error);
      assert.equal(
        readFileSync(join(root, ".env"), "utf8"),
        "TEST_ONLY=preserved\n",
      );
      const calls = readFileSync(log, "utf8");
      assert.doesNotMatch(
        calls,
        /--clean|--create|\bdown\b|\bdropdb\b|--force-recreate/,
      );
      return { ...result, calls };
    };
    fn({ root, input, run });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("backup publishes a private checked archive and exact configuration without stopping web", () =>
  fixture(({ root, run }) => {
    const result = run("backup");
    assert.equal(result.status, 0, result.stderr);
    const folders = readdirSync(join(root, "backups"));
    assert.equal(folders.length, 1);
    assert.match(folders[0], /^backup-/);
    const folder = join(root, "backups", folders[0]);
    assert.equal(statSync(folder).mode & 0o777, 0o700);
    for (const name of ["database.dump", ".env"]) {
      assert.equal(statSync(join(folder, name)).mode & 0o777, 0o600);
      assert.equal(
        readFileSync(join(folder, `${name}.sha256`), "utf8").trim(),
        digest(readFileSync(join(folder, name))),
      );
    }
    assert.equal(
      readFileSync(join(folder, ".env"), "utf8"),
      "TEST_ONLY=preserved\n",
    );
    assert.doesNotMatch(result.calls, /stop test-web/);
  }));
for (const scenario of ["dump-failure", "archive-failure"]) {
  test(`${scenario} leaves no partial backup presented as complete`, () =>
    fixture(({ root, run }) => {
      const result = run("backup", scenario);
      assert.notEqual(result.status, 0);
      assert.deepEqual(readdirSync(join(root, "backups")), []);
      assert.doesNotMatch(result.stdout, /备份完成/);
    }));
}
for (const name of ["database.dump", ".env"]) {
  test(`damaged ${name} is rejected before starting any database`, () =>
    fixture(({ input, run }) => {
      writeFileSync(join(input, name), "damaged");
      const result = run("restore", "success", [input]);
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.calls, /up -d db|pg_restore|stop test-web/);
    }));
}
test("nonempty database is refused before stopping web or restoring", () =>
  fixture(({ input, run }) => {
    const result = run("restore", "nonempty", [input]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /不是空库/);
    assert.doesNotMatch(result.calls, /stop test-web|pg_restore -U/);
  }));
test("restore targets an empty database using one transaction and leaves web stopped", () =>
  fixture(({ input, run }) => {
    const result = run("restore", "success", [input]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.calls,
      /psql [\s\S]*stop test-web[\s\S]*pg_restore -U ai_service -d ai_service --no-owner --no-privileges --single-transaction --exit-on-error/,
    );
    assert.match(result.stdout, /数据库恢复完成/);
  }));
test("failed restore reports failure without launching the website", () =>
  fixture(({ input, run }) => {
    const result = run("restore", "restore-failure", [input]);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /数据库恢复完成/);
    assert.doesNotMatch(result.calls, /up -d .*web/);
  }));
test("restore without a folder is rejected without initializing .env", () =>
  fixture(({ root, run }) => {
    rmSync(join(root, ".env"));
    // Check parsing directly: fixture run asserts that existing .env is retained.
    const result = spawnSync("bash", ["deploy.sh", "podman", "restore"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(root, ".env")), false);
  }));
