import "server-only";
import { publicOrderFields } from "./commerce";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { hash } from "./auth";
import { HttpError } from "./http";
import { requestSchema, updateSchema } from "./validation";

export const publicFields = {
  order: { select: publicOrderFields },
  number: true,
  service: true,
  scene: true,
  status: true,
  publicNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createRequest(input: unknown) {
  const { lookupKey, consent: _consent, ...data } = requestSchema.parse(input);
  const lookupHash = hash(lookupKey);
  const payloadHash = hash(JSON.stringify(data));
  const existing = await db().serviceRequest.findUnique({
    where: { lookupHash },
  });
  const receipt = (record: { number: string; payloadHash: string }) => {
    if (record.payloadHash !== payloadHash)
      throw new HttpError(
        409,
        "该查询凭证已用于另一份需求，请重新整理后提交。",
      );
    return { number: record.number };
  };
  if (existing) return receipt(existing);
  // PostgreSQL resolves a concurrent insert at the unique constraint. The
  // following read sees the committed winner, without recovering an aborted insert.
  return db().$transaction(async (tx) => {
    const inserted = await tx.serviceRequest.createMany({
      data: {
        ...data,
        lookupHash,
        payloadHash,
        number: `AI-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`,
      },
      skipDuplicates: true,
    });
    const record = await tx.serviceRequest.findUniqueOrThrow({
      where: { lookupHash },
    });
    if (inserted.count) {
      await tx.requestEvent.create({
        data: { requestId: record.id, status: "NEW", actor: "customer" },
      });
    }
    return receipt(record);
  });
}

export async function updateRequest(id: string, input: unknown, actor: string) {
  const { revision, ...data } = updateSchema.parse(input);
  return db().$transaction(async (tx) => {
    const updated = await tx.serviceRequest.updateMany({
      where: { id, revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (!updated.count)
      throw new HttpError(409, "这份需求已更新或不存在，请刷新页面后重试。");
    await tx.requestEvent.create({
      data: { requestId: id, status: data.status, actor },
    });
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        status: true,
        publicNote: true,
        internalNote: true,
        revision: true,
        updatedAt: true,
      },
    });
  });
}
