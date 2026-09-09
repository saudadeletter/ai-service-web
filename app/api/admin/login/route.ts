import { authenticate, cookieOptions, sessionCookie } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { loginSchema } from "@/lib/server/validation";
import { rateLimit } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await rateLimit(request, "login", 10, 15 * 60 * 1000);
    const { username, password } = loginSchema.parse(await readJson(request));
    const token = await authenticate(username, password);
    const response = json({ ok: true });
    response.cookies.set(sessionCookie, token, cookieOptions());
    return response;
  });
}
