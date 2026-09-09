import "server-only";
import { z } from "zod";
import { serviceOptions } from "@/lib/request-options";
// Integer cents avoid floating-point rounding; quotes are capped at RMB 100,000.
export const amountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/, "金额最多两位小数，不能为负数。")
  .transform((value) => {
    const [yuan, cents = ""] = value.split(".");
    return Number(yuan) * 100 + Number(cents.padEnd(2, "0"));
  })
  .pipe(
    z
      .number()
      .int()
      .min(1, "金额至少为 0.01 元。")
      .max(10000000, "金额不能超过 100000 元。"),
  );
const revision = z.number().int().min(0);
const packageFields = {
  name: z.string().trim().min(2).max(80),
  service: z.enum(serviceOptions),
  description: z.string().trim().min(10).max(2000),
  price: amountSchema,
  isActive: z.boolean(),
};
export const createPackageSchema = z
  .object({ id: z.uuid(), ...packageFields })
  .strict();
export const updatePackageSchema = z
  .object({ ...packageFields, revision })
  .strict();
export const convertSchema = z
  .object({
    requestRevision: revision,
    packageId: z.uuid(),
    packageRevision: revision,
    amount: amountSchema,
    deliveryTerms: z
      .string()
      .trim()
      .min(10, "请至少用 10 个字符写明交付约定。")
      .max(2000),
    confirmed: z.literal(true, {
      error: "请先确认已与用户核对成交价和交付约定。",
    }),
  })
  .strict();
export const orderUpdateSchema = z
  .object({
    revision,
    status: z.enum([
      "CONFIRMED",
      "IN_PROGRESS",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ]),
    publicNote: z.string().trim().max(2000),
    deliveryNote: z.string().trim().max(4000),
  })
  .strict();
export const moneyEntrySchema = z
  .object({
    revision,
    idempotencyKey: z.string().regex(/^[a-f0-9]{48}$/),
    kind: z.enum(["PAYMENT", "REFUND"]),
    amount: amountSchema,
    reference: z.string().trim().min(3, "请填写收款或退款凭据编号。").max(120),
    note: z.string().trim().min(3, "请填写核对说明。").max(1000),
    confirmed: z.literal(true, { error: "请核对实际到账或退款记录后确认。" }),
  })
  .strict();

const correctionFields = {
  revision,
  idempotencyKey: z.string().regex(/^[a-f0-9]{48}$/),
  reason: z
    .string()
    .trim()
    .min(10, "请至少用 10 个字符说明核对情况和更正原因。")
    .max(2000),
  confirmed: z.literal(true, { error: "请核对实际交易后勾选确认。" }),
};
export const correctionSchema = z.object(correctionFields).strict();
export const ledgerReviewSchema = z
  .object({
    ...correctionFields,
    status: z.enum([
      "CONFIRMED",
      "IN_PROGRESS",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ]),
  })
  .strict();
