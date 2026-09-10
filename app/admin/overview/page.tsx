import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  MessageCircle,
  Package,
  ShieldCheck,
} from "lucide-react";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { orderStatusLabels } from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { LogoutButton } from "@/components/admin-auth";
import { RefreshOverview } from "@/components/refresh-overview";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理工作台" };

const timestamp = (date: Date) =>
  date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

export default async function Overview() {
  const username = await requireAdminPage();
  const orderCountQuery = db().serviceOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { status: "asc" },
  });
  // A single read snapshot keeps counts consistent with their short queues.
  const [
    newCount,
    orderCounts,
    reviewCount,
    activePackages,
    requests,
    reviews,
  ] = await db().$transaction(
    [
      db().serviceRequest.count({ where: { status: "NEW" } }),
      orderCountQuery,
      db().serviceOrder.count({ where: { needsReview: true } }),
      db().servicePackage.count({ where: { isActive: true } }),
      db().serviceRequest.findMany({
        where: { status: "NEW" },
        take: 5,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          number: true,
          service: true,
          scene: true,
          createdAt: true,
        },
      }),
      db().serviceOrder.findMany({
        where: { needsReview: true },
        take: 5,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          updatedAt: true,
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  const countOrders = (status: keyof typeof orderStatusLabels) =>
    orderCounts.find((item) => item.status === status)?._count._all || 0;
  const readAt = new Date();
  const metrics = [
    {
      label: "待沟通咨询",
      count: newCount,
      note: "查看尚未开始沟通的需求",
      href: "/admin?status=NEW",
      Icon: MessageCircle,
      tone: "green",
    },
    {
      label: "处理中订单",
      count: countOrders("IN_PROGRESS"),
      note: "查看正在办理或定制的订单",
      href: "/admin/orders?status=IN_PROGRESS",
      Icon: ClipboardList,
      tone: "blue",
    },
    {
      label: "待复核订单",
      count: reviewCount,
      note: "核对更正后的流水与交付状态",
      href: "/admin/orders?review=pending",
      Icon: ShieldCheck,
      tone: "amber",
    },
    {
      label: "已上架套餐",
      count: activePackages,
      note: "进入套餐管理，调整服务内容",
      href: "/admin/packages",
      Icon: Package,
      tone: "purple",
    },
  ];
  return (
    <div className="container page-shell overview-page">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">管理后台 · {username}</p>
          <h1>待办一目了然。</h1>
          <p className="muted">
            本次读取：
            <time dateTime={readAt.toISOString()}>{timestamp(readAt)}</time>
            （北京时间）
          </p>
        </div>
        <div className="overview-actions">
          <RefreshOverview />
          <LogoutButton />
        </div>
      </div>
      <div className="overview-metrics">
        {metrics.map(({ label, count, note, href, Icon, tone }) => (
          <Link
            className={`overview-metric overview-${tone}`}
            key={label}
            href={href}
          >
            <span className="overview-metric-label">
              <Icon size={21} aria-hidden="true" />
              {label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
            <strong>{count}</strong>
            <span className="overview-metric-note">{note}</span>
          </Link>
        ))}
      </div>
      {reviewCount > 0 && (
        <div className="overview-review-notice">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            有 <strong>{reviewCount}</strong> 个订单需要复核。
            <span>
              {" "}
              已完成或已取消的订单也可能需要复核，请先核对，再继续处理。
            </span>
          </p>
          <Link href="/admin/orders?review=pending" className="text-link">
            查看待复核 <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <div className="overview-queues">
        <section
          className="panel overview-queue"
          aria-labelledby="new-requests-heading"
        >
          <div className="overview-panel-heading">
            <div>
              <h2 id="new-requests-heading">等待首次沟通</h2>
              <p>按提交时间从早到晚，显示前 5 条。</p>
            </div>
            <Link className="text-link" href="/admin?status=NEW">
              查看全部（{newCount}）
            </Link>
          </div>
          {requests.length ? (
            <ul className="overview-list">
              {requests.map((item) => (
                <li key={item.id}>
                  <Link href={`/admin/requests/${item.id}`}>
                    <div>
                      <span className="overview-number">{item.number}</span>
                      <h3>{item.scene}</h3>
                      <p>{item.service}</p>
                      <time dateTime={item.createdAt.toISOString()}>
                        提交于 {timestamp(item.createdAt)}
                      </time>
                    </div>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overview-empty">
              <MessageCircle size={28} aria-hidden="true" />
              <h3>暂时没有待沟通咨询</h3>
              <p>新需求提交后会显示在这里。也可以查看已开始跟进的咨询。</p>
              <Link href="/admin" className="text-link">
                查看咨询需求
              </Link>
            </div>
          )}
        </section>
        <section
          className="panel overview-queue"
          aria-labelledby="reviews-heading"
        >
          <div className="overview-panel-heading">
            <div>
              <h2 id="reviews-heading">需要复核的订单</h2>
              <p>按最后更新时间从早到晚，显示前 5 条。</p>
            </div>
            <Link className="text-link" href="/admin/orders?review=pending">
              查看全部（{reviewCount}）
            </Link>
          </div>
          {reviews.length ? (
            <ul className="overview-list">
              {reviews.map((item) => (
                <li key={item.id}>
                  <Link href={`/admin/orders/${item.id}`}>
                    <div>
                      <span className="overview-number">{item.number}</span>
                      <h3>{item.title}</h3>
                      <p>
                        <span className="pill">
                          {orderStatusLabels[item.status]}
                        </span>
                      </p>
                      <time dateTime={item.updatedAt.toISOString()}>
                        更新于 {timestamp(item.updatedAt)}
                      </time>
                    </div>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overview-empty">
              <ShieldCheck size={28} aria-hidden="true" />
              <h3>当前没有待复核订单</h3>
              <p>需要核对的流水更正会在这里提醒你。</p>
              <Link href="/admin/orders" className="text-link">
                查看订单管理
              </Link>
            </div>
          )}
        </section>
      </div>
      <section
        className="panel overview-stages"
        aria-labelledby="order-stages-heading"
      >
        <div className="overview-panel-heading">
          <div>
            <h2 id="order-stages-heading">订单交付概览</h2>
            <p>按当前交付状态统计；待复核标记可能与这些状态重叠。</p>
          </div>
          <Link href="/admin/orders" className="text-link">
            全部订单
          </Link>
        </div>
        <div className="overview-stage-grid">
          {Object.entries(orderStatusLabels).map(([status, label]) => (
            <Link key={status} href={`/admin/orders?status=${status}`}>
              <span>{label}</span>
              <strong>
                {countOrders(status as keyof typeof orderStatusLabels)}
              </strong>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
