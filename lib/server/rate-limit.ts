import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";

export async function rateLimit(
  request: Request,
  action: string,
  limit: number,
  windowMs: number,
) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Rate limiter is not configured");
  // Only trust a reverse proxy when explicitly enabled and direct access is blocked.
  const ip =
    process.env.TRUST_PROXY === "true"
      ? (request.headers.get("x-real-ip") || "unknown").slice(0, 100)
      : "direct";
  const key = createHmac("sha256", secret)
    .update(`${action}:${ip}`)
    .digest("hex");
  const now = new Date();
  const expiry = new Date(now.getTime() + windowMs);
  const [bucket] = await db().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiry})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateBucket"."expiresAt" <= ${now} THEN 1 ELSE LEAST("RateBucket"."count" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "RateBucket"."expiresAt" <= ${now} THEN ${expiry} ELSE "RateBucket"."expiresAt" END
    RETURNING "count"`;
  if (bucket.count > limit)
    throw new HttpError(429, "操作过于频繁，请稍后再试。");
}
