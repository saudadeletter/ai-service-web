import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { money, paymentLabel, orderStatusLabels } from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { OrderEditor, MoneyForm } from "@/components/order-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "订单详情" };
const date = (d: Date) =>
  d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const item = await db().serviceOrder.findUnique({
    where: { id },
    include: {
      request: { select: { id: true, number: true, contact: true } },
      events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 },
      moneyEntries: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      },
      _count: { select: { moneyEntries: true } },
    },
  });
  if (!item) notFound();
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">{item.number}</p>
          <h1>{item.title}</h1>
          <p>
            {orderStatusLabels[item.status]} · {paymentLabel(item)}
          </p>
        </div>
        <Link className="text-link" href={`/admin/requests/${item.request.id}`}>
          原咨询 {item.request.number}
        </Link>
      </div>
      <div className="stats">
        <div className="stat">
          <span>成交金额</span>
          <strong>{money(item.amountCents)}</strong>
        </div>
        <div className="stat">
          <span>累计登记收款</span>
          <strong>{money(item.paidCents)}</strong>
        </div>
        <div className="stat">
          <span>累计登记退款</span>
          <strong>{money(item.refundedCents)}</strong>
        </div>
      </div>
      <section className="panel">
        <h2>成交约定</h2>
        <p>
          {item.service} · 创建于 {date(item.createdAt)}（北京时间）
        </p>
        <p>联系方式：{item.request.contact}</p>
        <p className="preserve-text">{item.deliveryTerms}</p>
        <p className="muted">
          套餐名称、成交金额和交付约定已固定，后续修改套餐不会改变本订单。
        </p>
      </section>
      <div className="commerce-columns">
        <OrderEditor
          key={`order-${item.revision}`}
          id={id}
          revision={item.revision}
          status={item.status}
          publicNote={item.publicNote}
          deliveryNote={item.deliveryNote}
        />
        <MoneyForm
          key={`money-${item.revision}`}
          id={id}
          revision={item.revision}
          cancelled={item.status === "CANCELLED"}
        />
      </div>
      <section className="panel">
        <h2>收退款记录</h2>
        <p>
          共 {item._count.moneyEntries} 笔，显示最近 50
          笔。凭据与核对说明仅管理员可见。
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">收退款登记流水</caption>
            <thead>
              <tr>
                <th>时间 / 操作人</th>
                <th>类型</th>
                <th>金额</th>
                <th>凭据编号</th>
                <th>核对说明</th>
              </tr>
            </thead>
            <tbody>
              {item.moneyEntries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {date(e.createdAt)}
                    <br />
                    {e.actor}
                  </td>
                  <td>{e.kind === "PAYMENT" ? "收款" : "退款"}</td>
                  <td>{money(e.amountCents)}</td>
                  <td>{e.reference}</td>
                  <td className="preserve-text">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!item.moneyEntries.length && (
          <p className="admin-empty">尚未登记收款或退款。</p>
        )}
      </section>
      <section className="panel">
        <h2>处理与交付记录</h2>
        <p>显示最近 30 次保存。各次说明均保留，便于追溯。</p>
        <ol className="timeline">
          {item.events.map((e) => (
            <li key={e.id} className="done">
              <strong>
                {orderStatusLabels[e.status]} · {date(e.createdAt)}
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
      </section>
    </div>
  );
}
