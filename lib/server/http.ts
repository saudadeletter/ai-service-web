import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function appOrigin() {
  if (!process.env.APP_URL) throw new Error("APP_URL is not configured");
  const url = new URL(process.env.APP_URL);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid APP_URL");
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("HTTPS is required");
  return url.origin;
}

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new HttpError(403, "请求来源不正确，请从本站页面重试。");
}

export async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new HttpError(415, "请使用页面表单提交。");
  if (!request.body) throw new HttpError(400, "缺少请求内容。");
  const limit = 32 * 1024;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "提交内容过长，请精简后重试。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "请求内容格式不正确。");
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function endpoint(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        { error: error.issues[0]?.message || "请检查填写内容。" },
        400,
      );
    // Do not log submitted content, cookies, database URLs or query credentials.
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string" &&
      /^P\d{4}$/.test(error.code)
        ? error.code
        : undefined;
    console.error(
      "Request processing failed",
      error instanceof Error ? error.name : "UnknownError",
      code || "",
    );
    return json(
      { error: "服务暂时不可用，填写内容仍在页面中，请稍后重试。" },
      503,
    );
  }
}
