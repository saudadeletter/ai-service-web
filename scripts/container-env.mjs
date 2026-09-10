// Executed via stdin inside a temporary Node container; no npm or host mounts.
import { randomBytes, scryptSync } from "node:crypto";

const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16).toString("hex");
const postgresPassword = randomBytes(24).toString("hex");
const config = {
  POSTGRES_PASSWORD: postgresPassword,
  DATABASE_URL: `postgresql://ai_service:${postgresPassword}@127.0.0.1:5432/ai_service`,
  APP_URL: "http://localhost:3000",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  TRUST_PROXY: "false",
  NEXT_PUBLIC_ICP_NUMBER: "",
  DATABASE_POOL_SIZE: "5",
};
process.stdout.write(
  "# Generated container settings. Keep this file with database backups.\n" +
    Object.entries(config)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
);
// The deployment script captures stderr in a private local credentials file.
process.stderr.write(
  `管理员用户名：admin\n管理员初始密码：${password}\n登录地址：http://localhost:3000/admin/login\n请保存到密码管理器；随后可删除本文件。\n`,
);
