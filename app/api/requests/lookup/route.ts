import { db } from "@/lib/server/db";
import { hash } from "@/lib/server/auth";
import { publicFields } from "@/lib/server/requests";
import {
  endpoint,
  HttpError,
  json,
  readJson,
  sameOrigin,
} from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { lookupSchema } from "@/lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await rateLimit(request, "lookup", 30, 15 * 60 * 1000);
    const input = lookupSchema.parse(await readJson(request));
    const record = await db().serviceRequest.findFirst({
      where: { number: input.number, lookupHash: hash(input.lookupKey) },
      select: publicFields,
    });
    if (!record)
      throw new HttpError(404, "需求编号或查询码不正确，请核对保存的凭证。");
    return json(record);
  });
}
