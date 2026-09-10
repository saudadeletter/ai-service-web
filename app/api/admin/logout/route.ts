import { revokeSession, cookieOptions, sessionCookie } from "@/lib/server/auth";
import { endpoint, json, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await revokeSession();
    const response = json({ ok: true });
    response.cookies.set(sessionCookie, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  });
}
