import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { money, orderStatusLabels } from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "完整流水与处理历史" };
const date = (d: Date) =>
  d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
export default async function LedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    kind?: string;
    state?: string;
    page?: string;
  }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const query = await searchParams;
  const order = await db().serviceOrder.findUnique({
    where: { id },
    select: {
      number: true,
      paidCents: true,
      refundedCents: true,
      needsReview: true,
    },
  });
  if (!order) notFound();
  const view =
    query.view === "reviews" || query.view === "events"
      ? query.view
      : "entries";
  const kind =
    query.kind === "PAYMENT" || query.kind === "REFUND"
      ? query.kind
      : undefined;
  const state =
    query.state === "active" || query.state === "corrected"
      ? query.state
      : undefined;
  const page = Math.max(
    1,
    Math.min(1000000, parseInt(String(query.page || 1), 10) || 1),
  );
  const where: Prisma.MoneyEntryWhereInput = {
    orderId: id,
    ...(kind ? { kind } : {}),
    ...(state
      ? { correction: state === "active" ? null : { isNot: null } }
      : {}),
  };
  const paging = {
    skip: (page - 1) * 25,
    take: 25,
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  };
  const [entries, reviews, events, total] = await Promise.all([
    view === "entries"
      ? db().moneyEntry.findMany({
          where,
          ...paging,
          include: { correction: true },
        })
      : Promise.resolve([]),
    view === "reviews"
      ? db().ledgerReview.findMany({ where: { orderId: id }, ...paging })
      : Promise.resolve([]),
    view === "events"
      ? db().orderEvent.findMany({ where: { orderId: id }, ...paging })
      : Promise.resolve([]),
    view === "entries"
      ? db().moneyEntry.count({ where })
      : view === "reviews"
        ? db().ledgerReview.count({ where: { orderId: id } })
        : db().orderEvent.count({ where: { orderId: id } }),
  ]);
  const href = (p: number) =>
    `?${new URLSearchParams({ view, ...(kind ? { kind } : {}), ...(state ? { state } : {}), page: String(p) })}`;
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">{order.number}</p>
          <h1>完整流水与处理历史</h1>
          <p>
            有效收款 {money(order.paidCents)} · 有效退款{" "}
            {money(order.refundedCents)}
            {order.needsReview ? " · 待复核" : ""}
          </p>
        </div>
        <Link className="text-link" href={`/admin/orders/${id}`}>
          返回订单
        </Link>
      </div>
      <nav className="admin-nav" aria-label="记录分类">
        <Link
          href="?view=entries"
          aria-current={view === "entries" ? "page" : undefined}
        >
          收退款流水
        </Link>
        <Link
          href="?view=reviews"
          aria-current={view === "reviews" ? "page" : undefined}
        >
          账目复核记录
        </Link>
        <Link
          href="?view=events"
          aria-current={view === "events" ? "page" : undefined}
        >
          处理与交付历史
        </Link>
      </nav>
      <section className="panel">
        {view === "entries" && (
          <>
            <form
              className="admin-filters"
              action={`/admin/orders/${id}/ledger`}
            >
              <div className="field">
                <label htmlFor="kind">流水类型</label>
                <select id="kind" name="kind" defaultValue={kind || ""}>
                  <option value="">全部</option>
                  <option value="PAYMENT">收款</option>
                  <option value="REFUND">退款</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="state">登记状态</label>
                <select id="state" name="state" defaultValue={state || ""}>
                  <option value="">全部</option>
                  <option value="active">有效</option>
                  <option value="corrected">已冲正</option>
                </select>
              </div>
              <Button type="submit">筛选</Button>
            </form>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">收退款流水，每页 25 笔</caption>
                <thead>
                  <tr>
                    <th>时间 / 登记人</th>
                    <th>类型 / 金额</th>
                    <th>凭据 / 说明</th>
                    <th>登记状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {date(e.createdAt)}
                        <br />
                        {e.actor}
                      </td>
                      <td>
                        {e.kind === "PAYMENT" ? "收款" : "退款"}
                        <br />
                        {money(e.amountCents)}
                      </td>
                      <td>
                        {e.reference}
                        <p className="preserve-text">{e.note}</p>
                      </td>
                      <td>
                        {e.correction ? (
                          <>
                            <span className="pill">已冲正，不计入合计</span>
                            <p>
                              {e.correction.actor} ·{" "}
                              {date(e.correction.createdAt)}
                            </p>
                            <p className="preserve-text">
                              {e.correction.reason}
                            </p>
                          </>
                        ) : (
                          "有效"
                        )}
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/admin/orders/${id}/ledger/${e.id}`}
                        >
                          {e.correction ? "查看详情" : "核对 / 冲正"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {view === "reviews" && (
          <ol className="timeline">
            {reviews.map((r) => (
              <li className="done" key={r.id}>
                <strong>
                  {date(r.createdAt)} · {r.actor}
                </strong>
                <p>
                  {orderStatusLabels[r.previousStatus]} →{" "}
                  {orderStatusLabels[r.status]}
                </p>
                <p>
                  当时有效收款 {money(r.paidCents)} · 有效退款{" "}
                  {money(r.refundedCents)}
                </p>
                <p className="preserve-text">{r.reason}</p>
              </li>
            ))}
          </ol>
        )}
        {view === "events" && (
          <ol className="timeline">
            {events.map((e) => (
              <li className="done" key={e.id}>
                <strong>
                  {date(e.createdAt)} · {orderStatusLabels[e.status]}
                </strong>
                <p>{e.actor}</p>
                {e.publicNote && (
                  <p className="preserve-text">处理说明：{e.publicNote}</p>
                )}
                {e.deliveryNote && (
                  <p className="preserve-text">交付说明：{e.deliveryNote}</p>
                )}
              </li>
            ))}
          </ol>
        )}
        {!entries.length && !reviews.length && !events.length && (
          <p className="admin-empty">当前页没有符合条件的记录。</p>
        )}
        <div className="pagination">
          <span>
            共 {total} 条 · 第 {page} 页 · 时间为北京时间
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
