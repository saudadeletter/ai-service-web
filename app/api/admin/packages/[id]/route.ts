import { requireAdmin } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { updatePackage } from "@/lib/server/commerce";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    await requireAdmin();
    const { id } = await params;
    return json(await updatePackage(id, await readJson(request)));
  });
}
