import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { money } from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { LedgerAction } from "@/components/ledger-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "流水核对与冲正" };
export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  await requireAdminPage();
  const { id, entryId } = await params;
  const entry = await db().moneyEntry.findFirst({
    where: { id: entryId, orderId: id },
    include: {
      correction: true,
      order: {
        select: {
          number: true,
          status: true,
          revision: true,
          paidCents: true,
          refundedCents: true,
        },
      },
    },
  });
  if (!entry) notFound();
  const order = entry.order;
  const paid =
    order.paidCents - (entry.kind === "PAYMENT" ? entry.amountCents : 0);
  const refunded =
    order.refundedCents - (entry.kind === "REFUND" ? entry.amountCents : 0);
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">{order.number}</p>
          <h1>流水核对与冲正</h1>
        </div>
        <Link className="text-link" href={`/admin/orders/${id}/ledger`}>
          返回完整流水
        </Link>
      </div>
      <section className="panel">
        <h2>原始登记</h2>
        <dl className="request-meta">
          <div>
            <dt>类型 / 金额</dt>
            <dd>
              {entry.kind === "PAYMENT" ? "收款" : "退款"} ·{" "}
              {money(entry.amountCents)}
            </dd>
          </div>
          <div>
            <dt>交易凭据</dt>
            <dd>{entry.reference}</dd>
          </div>
          <div>
            <dt>登记人 / 时间</dt>
            <dd>
              {entry.actor} ·{" "}
              {entry.createdAt.toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
              })}
              （北京时间）
            </dd>
          </div>
          <div>
            <dt>核对说明</dt>
            <dd className="preserve-text">{entry.note}</dd>
          </div>
        </dl>
      </section>
      {entry.correction ? (
        <section className="panel">
          <h2>本笔已冲正</h2>
          <p>本笔金额不再计入有效合计，原始登记仍保留。</p>
          <p>
            {entry.correction.actor} ·{" "}
            {entry.correction.createdAt.toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
            })}
          </p>
          <p className="preserve-text">{entry.correction.reason}</p>
          <Link className="text-link" href={`/admin/orders/${id}`}>
            返回订单补录或复核
          </Link>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>冲正后的有效合计</h2>
            <p>
              有效收款 {money(paid)} · 有效退款 {money(refunded)}
            </p>
            <p>
              冲正不会改变实际资金，也不会自动取消或完成订单。订单将进入待复核。
            </p>
          </section>
          <LedgerAction
            key={order.revision}
            orderId={id}
            entryId={entryId}
            revision={order.revision}
            status={order.status}
            blocked={paid < refunded || paid < 0 || refunded < 0}
          />
        </>
      )}
    </div>
  );
}
