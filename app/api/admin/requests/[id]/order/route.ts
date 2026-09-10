import { requireAdmin } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { convertRequest } from "@/lib/server/commerce";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    return json(await convertRequest(id, await readJson(request), admin), 201);
  });
}
