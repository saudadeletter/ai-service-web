import { migrationUpgradeCheck } from "./migration-upgrade.mjs";
import { correctionChecks } from "./corrections.mjs";
import { commerceChecks } from "./commerce.mjs";
import assert from "node:assert/strict";
import { randomBytes, createHash, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as pause } from "node:timers/promises";
import pg from "pg";

// Use a dedicated database. No table resets or deletions of unrelated requests.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error(
    "请设置 TEST_DATABASE_URL，数据库名称必须以 _test 结尾。请勿使用生产数据库。",
  );
const salt = randomBytes(16).toString("hex");
const password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  CHECKPOINT_DISABLE: "1",
  ADMIN_USERNAME: "integration-admin",
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  TRUST_PROXY: "true",
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const netServer = createServer();
netServer.listen(0, "127.0.0.1");
await once(netServer, "listening");
const port = netServer.address().port;
await new Promise((resolve) => netServer.close(resolve));
const base = `http://localhost:${port}`;
env.APP_URL = base;
const sql = new pg.Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 1000,
});
let server;
let serverLog = "";
let checks = 0;
const requestIds = [];
const packageIds = [];
const sessionHashes = [];
let requestSequence = 0;
async function check(name, action) {
  await action();
  checks++;
  console.log(`PASS ${name}`);
}
async function call(
  path,
  body,
  {
    method = "POST",
    cookie,
    origin = base,
    ip = `198.51.100.${++requestSequence}`,
    raw,
  } = {},
) {
  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
    "X-Real-IP": ip,
  };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(base + path, {
    method,
    headers,
    body: raw ?? JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return { response, data: await response.json().catch(() => null) };
}
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.on("error", (err) => {
    serverLog += err.message;
  });
  server.stdout.on("data", (data) => {
    serverLog = (serverLog + data).slice(-5000);
  });
  server.stderr.on("data", (data) => {
    serverLog = (serverLog + data).slice(-5000);
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error(`测试应用提前退出：${serverLog}`);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await pause(200);
  }
  throw new Error("测试应用启动超时。");
}
async function stop() {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
    timer.unref();
    await exited;
    clearTimeout(timer);
  }
}
async function login() {
  const { response } = await call("/api/admin/login", {
    username: env.ADMIN_USERNAME,
    password,
  });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=strict/i);
  const cookie = header.split(";")[0];
  sessionHashes.push(hash(cookie.split("=")[1]));
  return cookie;
}

try {
  const migration = spawn(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let migrationLog = "";
  migration.stdout.on("data", (data) => {
    migrationLog += data;
  });
  migration.stderr.on("data", (data) => {
    migrationLog += data;
  });
  const [code] = await once(migration, "exit");
  assert.equal(code, 0, migrationLog);
  await migrationUpgradeCheck({ check, sql });
  await start();
  await check("未登录时后台重定向且不返回客户信息", async () => {
    const response = await fetch(base + "/admin", { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/admin/login");
  });
  await check("跨站提交被拒绝", async () => {
    assert.equal(
      (await call("/api/requests", {}, { origin: "https://other.example" }))
        .response.status,
      403,
    );
  });
  await check("服务端拒绝空白描述和未同意提交", async () => {
    const body = {
      service: "专属 AI 助手定制",
      scene: "期末复习",
      description: "                ",
      timeline: "一周内",
      budget: "希望先了解报价",
      contactType: "email",
      contact: "test@example.com",
      consent: false,
      lookupKey: randomBytes(24).toString("hex"),
    };
    assert.equal((await call("/api/requests", body)).response.status, 400);
  });
  await check("请求大小上限有效", async () => {
    assert.equal(
      (
        await call(
          "/api/requests",
          {},
          { raw: JSON.stringify({ padding: "a".repeat(33000) }) },
        )
      ).response.status,
      413,
    );
  });
  const lookupKey = randomBytes(24).toString("hex");
  const payload = {
    service: "专属 AI 助手定制",
    scene: "期末复习",
    description: "集成测试：请协助整理课程知识框架与复习计划。",
    timeline: "一周内",
    budget: "希望先了解报价",
    contactType: "email",
    contact: `test-${randomBytes(6).toString("hex")}@example.com`,
    consent: true,
    lookupKey,
  };
  let number;
  let id;
  await check("真实提交落库，原始查询码不入库", async () => {
    const result = await call("/api/requests", payload);
    assert.equal(
      result.response.status,
      201,
      JSON.stringify(result.data) + "\n" + serverLog,
    );
    number = result.data.number;
    const { rows } = await sql.query(
      'SELECT * FROM "ServiceRequest" WHERE "number" = $1',
      [number],
    );
    assert.equal(rows.length, 1);
    id = rows[0].id;
    requestIds.push(id);
    assert.equal(rows[0].lookupHash, hash(lookupKey));
    assert.equal(JSON.stringify(rows[0]).includes(lookupKey), false);
  });
  await check("重复提交不生成第二条需求", async () => {
    const results = await Promise.all([
      call("/api/requests", payload),
      call("/api/requests", payload),
    ]);
    for (const r of results) {
      assert.equal(r.response.status, 201);
      assert.equal(r.data.number, number);
    }
    const { rows } = await sql.query(
      'SELECT count(*)::int AS count FROM "ServiceRequest" WHERE "lookupHash" = $1',
      [hash(lookupKey)],
    );
    assert.equal(rows[0].count, 1);
  });
  await check("并发首次提交只保存一条需求", async () => {
    const concurrentKey = randomBytes(24).toString("hex");
    const results = await Promise.all([
      call("/api/requests", { ...payload, lookupKey: concurrentKey }),
      call("/api/requests", { ...payload, lookupKey: concurrentKey }),
    ]);
    const { rows } = await sql.query(
      'SELECT id FROM "ServiceRequest" WHERE "lookupHash" = $1',
      [hash(concurrentKey)],
    );
    for (const row of rows) requestIds.push(row.id);
    assert.equal(rows.length, 1);
    for (const result of results)
      assert.equal(
        result.response.status,
        201,
        JSON.stringify(result.data) + "\n" + serverLog,
      );
    assert.equal(results[0].data.number, results[1].data.number);
  });
  await check("同凭证不同内容拒绝覆盖", async () => {
    assert.equal(
      (
        await call("/api/requests", {
          ...payload,
          description: "这是另一份完全不同的有效测试需求描述。",
        })
      ).response.status,
      409,
    );
  });
  await check("错误查询码无法读取需求", async () => {
    assert.equal(
      (
        await call("/api/requests/lookup", {
          number,
          lookupKey: randomBytes(24).toString("hex"),
        })
      ).response.status,
      404,
    );
  });
  await check("查询只返回公开字段并禁用缓存", async () => {
    const result = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get("cache-control"), "no-store");
    assert.deepEqual(
      Object.keys(result.data).sort(),
      [
        "order",
        "number",
        "service",
        "scene",
        "status",
        "publicNote",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });
  const update = {
    status: "IN_PROGRESS",
    publicNote: "已收到资料，正在处理。",
    internalNote: "仅管理员可见的测试备注",
    revision: 0,
  };
  await check("未登录不能修改状态", async () => {
    assert.equal(
      (await call(`/api/admin/requests/${id}`, update, { method: "PATCH" }))
        .response.status,
      401,
    );
  });
  await check("错误密码不能创建登录会话", async () => {
    assert.equal(
      (
        await call("/api/admin/login", {
          username: env.ADMIN_USERNAME,
          password: "wrong",
        })
      ).response.status,
      401,
    );
  });
  let cookie;
  await check("管理员登录设置 HttpOnly 与 SameSite 会话", async () => {
    cookie = await login();
  });
  await check("登录后可查看需求列表和详情", async () => {
    for (const path of ["/admin", `/admin/requests/${id}`]) {
      const response = await fetch(base + path, {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes(number));
      assert.match(response.headers.get("cache-control"), /private|no-store/);
    }
  });
  await check("管理操作也拒绝跨站请求", async () => {
    assert.equal(
      (
        await call(`/api/admin/requests/${id}`, update, {
          method: "PATCH",
          cookie,
          origin: "https://other.example",
        })
      ).response.status,
      403,
    );
  });
  await check("状态更新、内部备注与处理记录持久保存", async () => {
    const result = await call(`/api/admin/requests/${id}`, update, {
      method: "PATCH",
      cookie,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.revision, 1);
    const publicResult = await call("/api/requests/lookup", {
      number,
      lookupKey,
    });
    assert.equal(publicResult.data.status, "IN_PROGRESS");
    assert.equal(publicResult.data.publicNote, update.publicNote);
    assert.equal(
      JSON.stringify(publicResult.data).includes(update.internalNote),
      false,
    );
    const { rows } = await sql.query(
      'SELECT count(*)::int AS count FROM "RequestEvent" WHERE "requestId" = $1',
      [id],
    );
    assert.equal(rows[0].count, 2);
  });
  await check("旧版本保存被拒绝，防止覆盖他人修改", async () => {
    assert.equal(
      (
        await call(`/api/admin/requests/${id}`, update, {
          method: "PATCH",
          cookie,
        })
      ).response.status,
      409,
    );
  });
  await commerceChecks({
    check,
    call,
    sql,
    base,
    cookie,
    id,
    number,
    lookupKey,
    requestIds,
    packageIds,
  });
  await correctionChecks({
    check,
    call,
    sql,
    base,
    cookie,
    id,
    number,
    lookupKey,
    requestIds,
    packageIds,
  });
  await check("退出后旧 Cookie 无法继续访问后台", async () => {
    assert.equal(
      (await call("/api/admin/logout", {}, { cookie })).response.status,
      200,
    );
    assert.equal(
      (
        await call(
          `/api/admin/requests/${id}`,
          { ...update, revision: 1 },
          { method: "PATCH", cookie },
        )
      ).response.status,
      401,
    );
  });
  await check("过期会话被拒绝", async () => {
    const expiredCookie = await login();
    await sql.query(
      'UPDATE "AdminSession" SET "expiresAt" = $1 WHERE "tokenHash" = $2',
      [new Date("2000-01-01T00:00:00Z"), hash(expiredCookie.split("=")[1])],
    );
    assert.equal(
      (
        await call(`/api/admin/requests/${id}`, update, {
          method: "PATCH",
          cookie: expiredCookie,
        })
      ).response.status,
      401,
    );
  });
  await check("请求限流在数据库中生效", async () => {
    let last;
    for (let i = 0; i < 11; i++)
      last = await call(
        "/api/admin/login",
        { username: env.ADMIN_USERNAME, password: "wrong" },
        { ip: "rate-limit-test" },
      );
    assert.equal(last.response.status, 429);
  });
  const oldCookie = await login();
  const newSalt = randomBytes(16).toString("hex");
  env.ADMIN_PASSWORD_HASH = `scrypt:${newSalt}:${scryptSync(randomBytes(32).toString("hex"), newSalt, 64).toString("hex")}`;
  await check("应用重启后仍能查询已提交需求", async () => {
    await stop();
    await start();
    const result = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.status, "IN_PROGRESS");
    assert.equal(result.data.order.status, "COMPLETED");
    assert.equal(result.data.order.paidCents, 8888);
    assert.equal(result.data.order.refundedCents, 888);
    assert.equal(result.data.order.needsReview, false);
  });
  await check("管理员密码变更后旧会话失效", async () => {
    assert.equal(
      (
        await call(`/api/admin/requests/${id}`, update, {
          method: "PATCH",
          cookie: oldCookie,
        })
      ).response.status,
      401,
    );
  });
  console.log(`\n${checks} integration checks passed.`);
} finally {
  await stop();
  if (requestIds.length)
    await sql.query(
      'DELETE FROM "ServiceOrder" WHERE "requestId" = ANY($1::text[])',
      [requestIds],
    );
  if (packageIds.length)
    await sql.query(
      'DELETE FROM "ServicePackage" WHERE "id" = ANY($1::text[])',
      [packageIds],
    );
  if (requestIds.length)
    await sql.query(
      'DELETE FROM "ServiceRequest" WHERE "id" = ANY($1::text[])',
      [requestIds],
    );
  if (sessionHashes.length)
    await sql.query(
      'DELETE FROM "AdminSession" WHERE "tokenHash" = ANY($1::text[])',
      [sessionHashes],
    );
  await sql.end();
}
