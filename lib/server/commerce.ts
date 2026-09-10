import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { hash } from "./auth";
import { HttpError } from "./http";
import {
  createPackageSchema,
  updatePackageSchema,
  convertSchema,
  orderUpdateSchema,
  moneyEntrySchema,
  correctionSchema,
  ledgerReviewSchema,
} from "./commerce-validation";
import { nextOrderStatuses } from "@/lib/order-options";

export const publicPackageFields = {
  id: true,
  name: true,
  service: true,
  description: true,
  priceCents: true,
} as const;
export const publicOrderFields = {
  needsReview: true,
  number: true,
  title: true,
  service: true,
  amountCents: true,
  paidCents: true,
  refundedCents: true,
  deliveryTerms: true,
  deliveryNote: true,
  publicNote: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
const conflict = () =>
  new HttpError(409, "内容已被更新，请刷新页面核对后重试。");

export async function createPackage(input: unknown) {
  const { id, price, ...fields } = createPackageSchema.parse(input);
  const data = { ...fields, priceCents: price };
  const creationHash = hash(JSON.stringify(data));
  return db().$transaction(async (tx) => {
    await tx.servicePackage.createMany({
      data: { id, ...data, creationHash },
      skipDuplicates: true,
    });
    const item = await tx.servicePackage.findUniqueOrThrow({ where: { id } });
    if (item.creationHash !== creationHash) throw conflict();
    return { id: item.id };
  });
}
export async function updatePackage(id: string, input: unknown) {
  const { revision, price, ...fields } = updatePackageSchema.parse(input);
  const result = await db().servicePackage.updateMany({
    where: { id, revision },
    data: { ...fields, priceCents: price, revision: { increment: 1 } },
  });
  if (!result.count) throw conflict();
  return { id };
}

// Locks are held until commit, so retries and concurrent admin windows see a
// consistent order plus ledger. All writers acquire the same order-row lock.
async function lockedOrder(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, "订单不存在。");
  return tx.serviceOrder.findUniqueOrThrow({ where: { id } });
}
export async function convertRequest(
  requestId: string,
  input: unknown,
  actor: string,
) {
  const data = convertSchema.parse(input);
  const conversionHash = hash(JSON.stringify(data));
  return db().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    if (!rows.length) throw new HttpError(404, "需求不存在。");
    const existing = await tx.serviceOrder.findUnique({ where: { requestId } });
    if (existing) {
      if (existing.conversionHash !== conversionHash)
        throw new HttpError(409, "这份需求已经生成订单，请进入现有订单处理。");
      return { id: existing.id, number: existing.number };
    }
    const request = await tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    if (request.revision !== data.requestRevision) throw conflict();
    if (["COMPLETED", "CLOSED"].includes(request.status))
      throw new HttpError(409, "已结束的需求不能转为订单，请先核对需求状态。");
    // Lock the chosen package so conversion cannot race an edit/deactivation.
    await tx.$queryRaw`SELECT "id" FROM "ServicePackage" WHERE "id" = ${data.packageId} FOR UPDATE`;
    const item = await tx.servicePackage.findUnique({
      where: { id: data.packageId },
    });
    if (!item?.isActive || item.revision !== data.packageRevision)
      throw new HttpError(409, "套餐已更新或下架，请刷新并重新确认报价。");
    const order = await tx.serviceOrder.create({
      data: {
        requestId,
        packageId: item.id,
        conversionHash,
        number: `SO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`,
        title: item.name,
        service: item.service,
        amountCents: data.amount,
        deliveryTerms: data.deliveryTerms,
        events: {
          create: {
            actor,
            status: "CONFIRMED",
            publicNote: "",
            deliveryNote: "",
          },
        },
      },
    });
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: { revision: { increment: 1 } },
    });
    return { id: order.id, number: order.number };
  });
}
export async function updateOrder(id: string, input: unknown, actor: string) {
  const { revision, ...data } = orderUpdateSchema.parse(input);
  return db().$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    if (order.revision !== revision) throw conflict();
    if (order.needsReview)
      throw new HttpError(409, "收退款记录尚待复核，请先完成账目复核。");
    if (data.status !== order.status) {
      if (!nextOrderStatuses[order.status].includes(data.status))
        throw new HttpError(409, "当前订单不能变更到所选状态。");
      const net = order.paidCents - order.refundedCents;
      if (data.status === "CANCELLED" && net !== 0)
        throw new HttpError(409, "取消前请先核对并登记剩余退款。");
      if (data.status !== "CANCELLED" && net !== order.amountCents)
        throw new HttpError(409, "请先核对并登记足额收款，再推进交付状态。");
    }
    if (["DELIVERED", "COMPLETED"].includes(data.status) && !data.deliveryNote)
      throw new HttpError(400, "请填写交付内容说明。");
    const updated = await tx.serviceOrder.update({
      where: { id },
      data: { ...data, revision: { increment: 1 } },
    });
    await tx.orderEvent.create({ data: { orderId: id, actor, ...data } });
    return { id, revision: updated.revision };
  });
}
export async function recordMoney(id: string, input: unknown, actor: string) {
  const {
    idempotencyKey,
    revision,
    confirmed: _confirmed,
    amount,
    ...data
  } = moneyEntrySchema.parse(input);
  const payloadHash = hash(JSON.stringify({ id, amount, ...data }));
  return db().$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    const existing = await tx.moneyEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash || existing.orderId !== id)
        throw conflict();
      return { id: existing.id, revision: order.revision };
    }
    if (order.revision !== revision) throw conflict();
    if (order.status === "CANCELLED" && !order.needsReview)
      throw new HttpError(409, "已取消的订单不能登记收退款。");
    if (data.kind === "PAYMENT") {
      if (
        !order.needsReview &&
        (order.refundedCents > 0 ||
          !["CONFIRMED", "IN_PROGRESS"].includes(order.status))
      )
        throw new HttpError(
          409,
          "该订单已退款或结束收款阶段，不能继续登记收款。",
        );
      if (order.paidCents + amount > order.amountCents)
        throw new HttpError(400, "累计收款不能超过成交金额。");
    } else if (amount > order.paidCents - order.refundedCents)
      throw new HttpError(400, "退款金额不能超过尚未退还的收款。");
    // Every ledger writer holds this order's lock. Corrected references can be
    // reused; concurrent active entries with the same reference are rejected.
    const referenceUsed = await tx.moneyEntry.findFirst({
      where: {
        orderId: id,
        kind: data.kind,
        reference: data.reference,
        correction: null,
      },
    });
    if (referenceUsed)
      throw new HttpError(409, "这笔凭据已登记，请核对历史记录，勿重复入账。");
    const entry = await tx.moneyEntry.create({
      data: {
        orderId: id,
        idempotencyKey,
        payloadHash,
        amountCents: amount,
        actor,
        ...data,
      },
    });
    const updated = await tx.serviceOrder.update({
      where: { id },
      data: {
        ...(data.kind === "PAYMENT"
          ? { paidCents: { increment: amount } }
          : { refundedCents: { increment: amount } }),
        revision: { increment: 1 },
      },
    });
    return { id: entry.id, revision: updated.revision };
  });
}

export async function correctMoney(
  id: string,
  entryId: string,
  input: unknown,
  actor: string,
) {
  const { revision, idempotencyKey, reason } = correctionSchema.parse(input);
  const payloadHash = hash(JSON.stringify({ id, entryId, reason }));
  return db().$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    const existing = await tx.moneyCorrection.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash || existing.entryId !== entryId)
        throw conflict();
      return { id: existing.id, revision: order.revision };
    }
    if (order.revision !== revision) throw conflict();
    const entry = await tx.moneyEntry.findFirst({
      where: { id: entryId, orderId: id },
      include: { correction: true },
    });
    if (!entry) throw new HttpError(404, "此订单中不存在这笔流水。");
    if (entry.correction)
      throw new HttpError(409, "这笔流水已经冲正，不能重复冲正。");
    const paidCents =
      order.paidCents - (entry.kind === "PAYMENT" ? entry.amountCents : 0);
    const refundedCents =
      order.refundedCents - (entry.kind === "REFUND" ? entry.amountCents : 0);
    if (paidCents < 0 || refundedCents < 0 || refundedCents > paidCents)
      throw new HttpError(
        409,
        "冲正后退款将超过有效收款，请先核对相关退款登记；确属错误的退款需先冲正。",
      );
    const correction = await tx.moneyCorrection.create({
      data: { entryId, idempotencyKey, payloadHash, reason, actor },
    });
    const updated = await tx.serviceOrder.update({
      where: { id },
      data: {
        paidCents,
        refundedCents,
        needsReview: true,
        revision: { increment: 1 },
      },
    });
    return { id: correction.id, revision: updated.revision };
  });
}

export async function reviewLedger(id: string, input: unknown, actor: string) {
  const { revision, idempotencyKey, reason, status } =
    ledgerReviewSchema.parse(input);
  const payloadHash = hash(JSON.stringify({ id, reason, status }));
  return db().$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    const existing = await tx.ledgerReview.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash || existing.orderId !== id)
        throw conflict();
      return { id: existing.id, revision: order.revision };
    }
    if (order.revision !== revision) throw conflict();
    if (!order.needsReview)
      throw new HttpError(409, "订单当前没有待复核的账目。");
    if (
      status !== order.status &&
      status !== "CONFIRMED" &&
      status !== "CANCELLED"
    )
      throw new HttpError(
        409,
        "复核只可保留原状态、退回待处理或取消订单，不能跳过交付流程。",
      );
    if (status === "CANCELLED" && order.paidCents !== order.refundedCents)
      throw new HttpError(
        409,
        "已取消订单必须退清有效收款；请核对记录，或退回待处理。",
      );
    if (
      ["IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(status) &&
      order.paidCents !== order.amountCents
    )
      throw new HttpError(
        409,
        "当前有效收款不足，不能保留该交付状态；请补齐正确登记或退回待处理。",
      );
    if (["DELIVERED", "COMPLETED"].includes(status) && !order.deliveryNote)
      throw new HttpError(409, "缺少交付说明，请退回待处理后补充。");
    const sums = await tx.moneyEntry.groupBy({
      by: ["kind"],
      where: { orderId: id, correction: null },
      _sum: { amountCents: true },
    });
    const sum = (kind: "PAYMENT" | "REFUND") =>
      sums.find((s) => s.kind === kind)?._sum.amountCents || 0;
    if (
      sum("PAYMENT") !== order.paidCents ||
      sum("REFUND") !== order.refundedCents
    )
      throw new HttpError(
        409,
        "流水合计与订单金额不一致，请停止处理并核对数据。",
      );
    const review = await tx.ledgerReview.create({
      data: {
        orderId: id,
        idempotencyKey,
        payloadHash,
        reason,
        actor,
        previousStatus: order.status,
        status,
        paidCents: order.paidCents,
        refundedCents: order.refundedCents,
      },
    });
    const updated = await tx.serviceOrder.update({
      where: { id },
      data: { status, needsReview: false, revision: { increment: 1 } },
    });
    await tx.orderEvent.create({
      data: {
        orderId: id,
        actor,
        status,
        publicNote: order.publicNote,
        deliveryNote: order.deliveryNote,
      },
    });
    return { id: review.id, revision: updated.revision };
  });
}
