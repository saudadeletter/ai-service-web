import { createRequest } from "@/lib/server/requests";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await rateLimit(request, "submit", 10, 15 * 60 * 1000);
    const receipt = await createRequest(await readJson(request));
    return json(receipt, 201);
  });
}
