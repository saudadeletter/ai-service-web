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
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Isolated command doubles: exercise deployment failure gates without real containers/data.
const engineMock = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  'info') [[ "$DEPLOY_TEST_CASE" != engine-failure ]] ;;
  'compose version') [[ "$DEPLOY_TEST_CASE" != provider-failure ]] ;;
  'volume ls --format {{.Name}}')
    if [[ "$DEPLOY_TEST_CASE" == missing-env-existing-volume ]]; then printf '%s_postgres_data\\n' "$COMPOSE_PROJECT_NAME"; fi ;;
  'run --rm -i '* )
    [[ "$DEPLOY_TEST_CASE" != bootstrap-failure ]] || exit 1
    exec node --input-type=module ;;
  *'ps -q')
    printf 'test-db\\n'
    if [[ "$DEPLOY_TEST_CASE" != fresh ]]; then printf 'test-web\\n'; fi ;;
  'inspect '*test-web) printf 'web\\n' ;;
  'inspect '*test-db) printf 'db\\n' ;;
  *'config') [[ "$DEPLOY_TEST_CASE" != config-failure ]] ;;
  *'build migrate web') [[ "$DEPLOY_TEST_CASE" != build-failure ]] ;;
  *'pg_isready'*) [[ "$DEPLOY_TEST_CASE" != db-failure ]] ;;
  'stop test-web') [[ "$DEPLOY_TEST_CASE" != stop-failure ]] ;;
  *'run --rm --no-deps migrate') [[ "$DEPLOY_TEST_CASE" != migrate-failure ]] ;;
  *'--force-recreate web') [[ "$DEPLOY_TEST_CASE" != recreate-failure ]] ;;
  *) exit 0 ;;
esac
`;

function run(scenario, engine = "podman", action = "deploy") {
  const root = mkdtempSync(join(tmpdir(), "ai-deploy-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    copyFileSync(
      new URL("../scripts/deploy.sh", import.meta.url),
      join(root, "scripts/deploy.sh"),
    );
    copyFileSync(
      new URL("../scripts/container-env.mjs", import.meta.url),
      join(root, "scripts/container-env.mjs"),
    );
    copyFileSync(
      new URL("../deploy.sh", import.meta.url),
      join(root, "deploy.sh"),
    );
    const fresh = [
      "fresh",
      "missing-env-existing-volume",
      "bootstrap-failure",
    ].includes(scenario);
    if (!fresh) writeFileSync(join(root, ".env"), "TEST_ONLY=preserved\n");
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
    const result = spawnSync(
      "bash",
      ["deploy.sh", ...[engine, action].filter(Boolean)],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${join(root, "bin")}:${process.env.PATH}`,
          DEPLOY_TEST_CASE: scenario,
          COMPOSE_PROJECT_NAME: "ai-deploy-test",
          DEPLOY_TEST_LOG: log,
        },
        encoding: "utf8",
        timeout: 15000,
      },
    );
    assert.ifError(result.error);
    if (!fresh)
      assert.equal(
        readFileSync(join(root, ".env"), "utf8"),
        "TEST_ONLY=preserved\n",
      );
    if (scenario === "fresh") {
      assert.equal(statSync(join(root, ".env")).mode & 0o777, 0o600);
      assert.equal(
        statSync(join(root, ".admin-credentials")).mode & 0o777,
        0o600,
      );
      const credentials = readFileSync(
        join(root, ".admin-credentials"),
        "utf8",
      );
      const password = credentials.match(/管理员初始密码：(.*)/)[1];
      assert.ok(!result.stdout.includes(password));
      assert.ok(!readFileSync(join(root, ".env"), "utf8").includes(password));
    } else if (fresh) {
      assert.equal(existsSync(join(root, ".env")), false);
      assert.equal(existsSync(join(root, ".admin-credentials")), false);
    }
    const calls = existsSync(log) ? readFileSync(log, "utf8") : "";
    assert.doesNotMatch(calls, /\b(down|prune|reset)\b/);
    return { ...result, calls };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const scenario of [
  "missing-env-existing-volume",
  "bootstrap-failure",
  "engine-failure",
  "provider-failure",
  "locked",
  "config-failure",
  "build-failure",
  "db-failure",
]) {
  test(`${scenario}: never stop or replace the existing website`, () => {
    const result = run(scenario);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(
      result.calls,
      /stop test-web|run --rm --no-deps migrate|force-recreate/,
    );
    assert.doesNotMatch(result.stdout, /部署完成/);
  });
}
test("fresh install generates private configuration and starts without an old web container", () => {
  const result = run("fresh");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /--network=none --log-driver=none/);
  assert.match(result.calls, /run --rm --no-deps migrate/);
  assert.doesNotMatch(result.calls, /stop test-web/);
});
test("ambiguous automatic engine selection requires an explicit engine", () => {
  const result = run("success", "");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /同时检测到/);
  assert.equal(result.calls, "");
});
for (const action of ["status", "logs", "stop"]) {
  test(`${action} does not build, migrate or initialize configuration`, () => {
    const result = run("success", "podman", action);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(
      result.calls,
      /build migrate|run --rm|force-recreate|pull/,
    );
    if (action === "stop")
      assert.match(result.calls, /stop test-web[\s\S]*stop test-db/);
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
  assert.match(result.calls, /stop test-web[\s\S]*run --rm --no-deps migrate/);
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
      /build migrate web[\s\S]*up -d db[\s\S]*pg_isready[\s\S]*stop test-web[\s\S]*run --rm --no-deps migrate[\s\S]*up -d --no-deps --force-recreate web[\s\S]*curl .*http:\/\/127\.0\.0\.1:3000\/packages/,
    );
    assert.match(result.stdout, /部署完成/);
  });
}
