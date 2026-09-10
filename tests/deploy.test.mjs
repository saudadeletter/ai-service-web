import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Isolated command doubles: exercise deployment failure gates without real containers/data.
const engineMock = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  *'config') [[ "$DEPLOY_TEST_CASE" != config-failure ]] ;;
  *'build migrate web') [[ "$DEPLOY_TEST_CASE" != build-failure ]] ;;
  *'pg_isready'*) [[ "$DEPLOY_TEST_CASE" != db-failure ]] ;;
  *'stop web') [[ "$DEPLOY_TEST_CASE" != stop-failure ]] ;;
  *'run --rm --no-deps migrate') [[ "$DEPLOY_TEST_CASE" != migrate-failure ]] ;;
  *'--force-recreate web') [[ "$DEPLOY_TEST_CASE" != recreate-failure ]] ;;
  *) exit 0 ;;
esac
`;

function run(scenario, engine = "podman") {
  const root = mkdtempSync(join(tmpdir(), "ai-deploy-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    copyFileSync(
      new URL("../scripts/deploy.sh", import.meta.url),
      join(root, "scripts/deploy.sh"),
    );
    if (scenario !== "missing-env")
      writeFileSync(join(root, ".env"), "TEST_ONLY=preserved\n");
    writeFileSync(join(root, "compose.yaml"), "services: {}\n");
    const commands = {
      podman: engineMock,
      docker: engineMock,
      curl: `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "$DEPLOY_TEST_LOG"
if [[ "$DEPLOY_TEST_CASE" == http-failure ]]; then printf 500; else printf 200; fi
`,
      sleep: "#!/usr/bin/env bash\nexit 0\n",
      flock: '#!/usr/bin/env bash\n[[ "$DEPLOY_TEST_CASE" != locked ]]\n',
    };
    for (const [name, code] of Object.entries(commands)) {
      writeFileSync(join(root, "bin", name), code, { mode: 0o755 });
    }
    const log = join(root, "calls.log");
    const result = spawnSync("bash", ["scripts/deploy.sh", engine], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        DEPLOY_TEST_CASE: scenario,
        DEPLOY_TEST_LOG: log,
      },
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ifError(result.error);
    if (scenario !== "missing-env")
      assert.equal(
        readFileSync(join(root, ".env"), "utf8"),
        "TEST_ONLY=preserved\n",
      );
    const calls = existsSync(log) ? readFileSync(log, "utf8") : "";
    assert.doesNotMatch(calls, /\b(down|prune|reset)\b/);
    return { ...result, calls };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const scenario of [
  "missing-env",
  "locked",
  "config-failure",
  "build-failure",
  "db-failure",
]) {
  test(`${scenario}: never stop or replace the existing website`, () => {
    const result = run(scenario);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.calls, /stop web|run --rm|force-recreate/);
    assert.doesNotMatch(result.stdout, /部署完成/);
  });
}
test("failed stop never runs migrations", () => {
  const result = run("stop-failure");
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.calls, /run --rm|force-recreate/);
});
test("failed migration keeps the website stopped", () => {
  const result = run("migrate-failure");
  assert.notEqual(result.status, 0);
  assert.match(result.calls, /stop web[\s\S]*run --rm --no-deps migrate/);
  assert.doesNotMatch(result.calls, /force-recreate|curl/);
});
for (const scenario of ["recreate-failure", "http-failure"]) {
  test(`${scenario}: never report success`, () => {
    const result = run(scenario);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /部署完成/);
    if (scenario === "http-failure")
      assert.equal(result.calls.match(/^curl /gm)?.length, 30);
  });
}
for (const engine of ["podman", "docker"]) {
  test(`${engine}: build, start DB, migrate, replace, and verify in order`, () => {
    const result = run("success", engine);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.calls,
      /build migrate web[\s\S]*up -d db[\s\S]*pg_isready[\s\S]*stop web[\s\S]*run --rm --no-deps migrate[\s\S]*up -d --no-deps --force-recreate web[\s\S]*curl .*http:\/\/127\.0\.0\.1:3000\/packages/,
    );
    assert.match(result.stdout, /部署完成/);
  });
}
