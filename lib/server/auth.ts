import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { appOrigin, HttpError } from "./http";

const derive = promisify(scrypt);
export const sessionCookie = "ai_admin_session";
export const sessionDuration = 8 * 60 * 60;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function credentials() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (
    !username ||
    !passwordHash ||
    !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)
  )
    throw new Error("Admin is not configured");
  return {
    username,
    passwordHash,
    version: hash(`${username}:${passwordHash}`),
  };
}

export async function authenticate(username: string, password: string) {
  const configured = credentials();
  const [, salt, digest] = configured.passwordHash.split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  const valid = timingSafeEqual(actual, Buffer.from(digest, "hex"));
  if (!valid || username !== configured.username)
    throw new HttpError(401, "用户名或密码不正确。");
  const token = randomBytes(32).toString("hex");
  await db().adminSession.create({
    data: {
      tokenHash: hash(token),
      credentialVersion: configured.version,
      expiresAt: new Date(Date.now() + sessionDuration * 1000),
    },
  });
  return token;
}

export async function currentAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const configured = credentials();
  const session = await db().adminSession.findUnique({
    where: { tokenHash: hash(token) },
  });
  return session &&
    session.expiresAt > new Date() &&
    session.credentialVersion === configured.version
    ? configured.username
    : null;
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new HttpError(401, "登录已失效，请重新登录。");
  return admin;
}

export async function requireAdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: appOrigin().startsWith("https:"),
  sameSite: "strict" as const,
  path: "/",
  maxAge: sessionDuration,
});

export async function revokeSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token))
    await db().adminSession.deleteMany({ where: { tokenHash: hash(token) } });
}
