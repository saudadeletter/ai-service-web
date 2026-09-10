import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { parse } from "dotenv";

const file = ".env";
let source = existsSync(file)
  ? readFileSync(file, "utf8")
  : "# Local settings. Never commit this file.\n";
const configured = parse(source);
const resetAdmin = process.argv.includes("--reset-admin");
const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16).toString("hex");
const postgresPassword =
  configured.POSTGRES_PASSWORD || randomBytes(24).toString("hex");
const defaults = {
  POSTGRES_PASSWORD: postgresPassword,
  DATABASE_URL: `postgresql://ai_service:${postgresPassword}@127.0.0.1:5432/ai_service`,
  APP_URL: "http://localhost:3000",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  TRUST_PROXY: "false",
};
let newPassword = false;
for (const [key, value] of Object.entries(defaults)) {
  if (configured[key] && !(key === "ADMIN_PASSWORD_HASH" && resetAdmin))
    continue;
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  source = pattern.test(source)
    ? source.replace(pattern, line)
    : `${source.trimEnd()}\n${line}\n`;
  if (key === "ADMIN_PASSWORD_HASH") newPassword = true;
}
writeFileSync(`${file}.tmp`, source, { mode: 0o600 });
renameSync(`${file}.tmp`, file);
console.log(
  resetAdmin
    ? "管理员密码已重置，其他已有配置保持不变。"
    : "本地配置已准备好；已有的非空配置保持不变。",
);
if (newPassword) {
  console.log(
    `管理员用户名：${configured.ADMIN_USERNAME || defaults.ADMIN_USERNAME}`,
  );
  console.log(`管理员密码（请保存）：${password}`);
}
console.log(
  "下一步：启动 PostgreSQL，然后执行 npm run db:migrate 和 npm run dev。",
);
if (resetAdmin) console.log("重启应用后新密码生效，旧的管理会话随之失效。");
