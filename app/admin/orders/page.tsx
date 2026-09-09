import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import {
  money,
  paymentLabel,
  orderStatusLabels,
  type OrderStatus,
} from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "订单管理" };
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    typeof params.status === "string" &&
    Object.hasOwn(orderStatusLabels, params.status)
      ? (params.status as OrderStatus)
      : undefined;
  const where: Prisma.ServiceOrderWhereInput = {
    ...(q ? { number: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    db().serviceOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        amountCents: true,
        paidCents: true,
        refundedCents: true,
        createdAt: true,
      },
    }),
    db().serviceOrder.count({ where }),
  ]);
  const href = (p: number) =>
    `?${new URLSearchParams({ q, status: status || "", page: String(p) })}`;
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">成交、收款与交付</p>
          <h1>订单管理</h1>
          <p>订单从咨询详情中生成。收退款状态由管理员核对实际交易后登记。</p>
        </div>
      </div>
      <section className="panel">
        <form action="/admin/orders" className="admin-filters">
          <div className="field">
            <label htmlFor="q">搜索订单编号</label>
            <input id="q" name="q" defaultValue={q} maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="status">订单状态</label>
            <select id="status" name="status" defaultValue={status || ""}>
              <option value="">全部状态</option>
              {Object.entries(orderStatusLabels).map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">筛选</Button>
        </form>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">订单列表</caption>
            <thead>
              <tr>
                <th>订单编号 / 套餐</th>
                <th>成交价</th>
                <th>收退款登记</th>
                <th>交付状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.number}
                    <br />
                    {p.title}
                  </td>
                  <td>{money(p.amountCents)}</td>
                  <td>{paymentLabel(p)}</td>
                  <td>{orderStatusLabels[p.status]}</td>
                  <td>
                    <Link className="text-link" href={`/admin/orders/${p.id}`}>
                      处理订单
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <p className="admin-empty">
            暂无符合条件的订单。与用户确认成交后，可在咨询详情中生成订单。
          </p>
        )}
        <div className="pagination">
          <span>
            共 {total} 条 · 第 {page} 页
          </span>
          <div>
            {page > 1 && <Link href={href(page - 1)}>上一页</Link>}
            {page * 25 < total && <Link href={href(page + 1)}>下一页</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
