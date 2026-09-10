import { requireAdmin } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { createPackage } from "@/lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await requireAdmin();

    return json(await createPackage(await readJson(request)), 201);
  });
}
