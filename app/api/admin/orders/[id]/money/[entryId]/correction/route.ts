import { requireAdmin } from "@/lib/server/auth";
import { endpoint, json, readJson, sameOrigin } from "@/lib/server/http";
import { correctMoney } from "@/lib/server/commerce";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const admin = await requireAdmin();
    const { id, entryId } = await params;
    return json(
      await correctMoney(id, entryId, await readJson(request), admin),
      201,
    );
  });
}
