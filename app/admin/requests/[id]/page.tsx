import { OrderConvert } from "@/components/order-convert";
import { AdminNav } from "@/components/admin-nav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { statusLabels } from "@/lib/request-options";
import { RequestEditor } from "@/components/request-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "处理需求" };
export default async function RequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^[a-z0-9]{20,32}$/.test(id)) notFound();
  const item = await db().serviceRequest.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, number: true } },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!item) notFound();
  const packages =
    !item.order && !["COMPLETED", "CLOSED"].includes(item.status)
      ? await db().servicePackage.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            service: true,
            priceCents: true,
            revision: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="breadcrumbs">
        <Link href="/admin">需求管理</Link>
        <span>/</span>
        <span>{item.number}</span>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{item.number}</p>
          <h1>{item.service}</h1>
        </div>
        <span className="pill">{statusLabels[item.status]}</span>
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>客户需求</h2>
            <dl className="request-meta">
              <div>
                <dt>使用场景</dt>
                <dd>{item.scene}</dd>
              </div>
              <div>
                <dt>联系方式</dt>
                <dd>
                  {item.contactType === "email" ? "邮箱" : "微信号"}：
                  {item.contact}
                </dd>
              </div>
              <div>
                <dt>希望完成时间</dt>
                <dd>{item.timeline}</dd>
              </div>
              <div>
                <dt>预算范围</dt>
                <dd>{item.budget}</dd>
              </div>
              <div>
                <dt>提交时间</dt>
                <dd>
                  {item.createdAt.toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                  })}
                  （北京时间）
                </dd>
              </div>
            </dl>
            <h3>具体描述</h3>
            <p className="preserve-text">{item.description}</p>
          </section>
          {item.order ? (
            <section className="panel">
              <h2>关联订单</h2>
              <Link
                className="text-link"
                href={`/admin/orders/${item.order.id}`}
              >
                {item.order.number} · 处理订单
              </Link>
              <p>咨询记录与订单处理分别保存。</p>
            </section>
          ) : (
            !["COMPLETED", "CLOSED"].includes(item.status) && (
              <OrderConvert
                key={item.revision}
                requestId={item.id}
                revision={item.revision}
                packages={packages}
              />
            )
          )}
          <RequestEditor
            id={item.id}
            status={item.status}
            publicNote={item.publicNote}
            internalNote={item.internalNote}
            revision={item.revision}
          />
        </div>
        <aside className="panel">
          <h2>处理记录</h2>
          <ol className="timeline">
            {item.events.map((event) => (
              <li key={event.id} className="done">
                <strong>{statusLabels[event.status]}</strong>
                <p>
                  {event.actor === "customer"
                    ? "用户提交"
                    : `管理员 ${event.actor} 保存`}
                </p>
                <p>
                  {event.createdAt.toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                  })}
                </p>
              </li>
            ))}
          </ol>
          <p>显示最近 30 次记录。联系方式和内部备注仅管理员可见。</p>
        </aside>
      </div>
    </div>
  );
}
