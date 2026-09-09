import "server-only";
import { z } from "zod";
import {
  budgetOptions,
  sceneOptions,
  serviceOptions,
  timelineOptions,
} from "@/lib/request-options";

export const lookupKeySchema = z
  .string()
  .regex(/^[a-f0-9]{48}$/, "查询码格式不正确。");
export const requestSchema = z
  .object({
    service: z.enum(serviceOptions),
    scene: z.enum(sceneOptions),
    description: z
      .string()
      .trim()
      .min(10, "请至少用 10 个字符描述需求。")
      .max(2000, "需求描述不能超过 2000 个字符。"),
    timeline: z.enum(timelineOptions),
    budget: z.enum(budgetOptions),
    contactType: z.enum(["email", "wechat"]),
    contact: z
      .string()
      .trim()
      .min(3, "请填写有效联系方式。")
      .max(120, "联系方式过长。"),
    consent: z.literal(true, {
      error: "请先同意将需求与联系方式提交给管理员。",
    }),
    lookupKey: lookupKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.contactType === "email" &&
      !z.email().safeParse(value.contact).success
    )
      ctx.addIssue({
        code: "custom",
        path: ["contact"],
        message: "请填写有效的邮箱地址。",
      });
    if (
      value.contactType === "wechat" &&
      !/^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(value.contact)
    )
      ctx.addIssue({
        code: "custom",
        path: ["contact"],
        message: "微信号需以字母开头，共 6–20 位，可含数字、下划线和连字符。",
      });
  });

export const lookupSchema = z
  .object({
    number: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^AI-\d{8}-[A-F0-9]{12}$/, "请检查需求编号格式。"),
    lookupKey: lookupKeySchema,
  })
  .strict();
export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(256),
  })
  .strict();
export const updateSchema = z
  .object({
    status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "COMPLETED", "CLOSED"]),
    publicNote: z
      .string()
      .trim()
      .max(2000, "用户可见说明不能超过 2000 个字符。"),
    internalNote: z.string().trim().max(4000, "内部备注不能超过 4000 个字符。"),
    revision: z.number().int().min(0),
  })
  .strict();
