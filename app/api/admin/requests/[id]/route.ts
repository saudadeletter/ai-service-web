import { requireAdmin } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { updateRequest } from "@/lib/server/requests";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    return json(await updateRequest(id, await readJson(request), admin));
  });
}
