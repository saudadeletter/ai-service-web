export const orderStatusLabels = {
  CONFIRMED: "待处理",
  IN_PROGRESS: "处理中",
  DELIVERED: "已交付",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
} as const;
export type OrderStatus = keyof typeof orderStatusLabels;
export const nextOrderStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
export function money(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}
export function paymentLabel(order: {
  amountCents: number;
  paidCents: number;
  refundedCents: number;
  needsReview?: boolean;
}) {
  if (order.needsReview) return "收退款记录待复核";
  if (order.refundedCents > 0)
    return order.refundedCents === order.paidCents
      ? "已全额登记退款"
      : "已登记部分退款";
  if (order.paidCents === 0) return "尚未登记收款";
  return order.paidCents === order.amountCents
    ? "已登记全额收款"
    : "已登记部分收款";
}
export type PackageOption = {
  id: string;
  name: string;
  service: string;
  priceCents: number;
  revision: number;
};
export type PublicOrder = {
  needsReview: boolean;
  number: string;
  title: string;
  service: string;
  amountCents: number;
  paidCents: number;
  refundedCents: number;
  deliveryTerms: string;
  deliveryNote: string;
  publicNote: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};
