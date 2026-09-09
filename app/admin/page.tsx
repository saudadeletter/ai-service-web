import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Prisma } from "@/generated/prisma/client";
import { statusLabels, type Status } from "@/lib/request-options";
import { LogoutButton } from "@/components/admin-auth";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "需求管理" };
export const dynamic = "force-dynamic";
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const username = await requireAdminPage();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    typeof params.status === "string" &&
    Object.hasOwn(statusLabels, params.status)
      ? (params.status as Status)
      : undefined;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(String(params.page || "1"), 10) || 1),
  );
  const where: Prisma.ServiceRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { number: { contains: q, mode: "insensitive" } } : {}),
  };
  const [items, total, counts] = await Promise.all([
    db().serviceRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      skip: (page - 1) * 25,
      select: {
        id: true,
        number: true,
        service: true,
        scene: true,
        contact: true,
        status: true,
        createdAt: true,
      },
    }),
    db().serviceRequest.count({ where }),
    db().serviceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (statuses: Status[]) =>
    counts
      .filter((c) => statuses.includes(c.status))
      .reduce((sum, c) => sum + c._count._all, 0);
  const pageHref = (target: number) =>
    `/admin?${new URLSearchParams({ q, status: status || "", page: String(target) })}`;
  return (
    <div className="container page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">管理后台 · {username}</p>
          <h1>需求管理</h1>
          <p className="muted">查看新的咨询，记录沟通与交付进度。</p>
        </div>
        <LogoutButton />
      </div>
      <div className="stats">
        <div className="stat">
          <span>待沟通</span>
          <strong>{count(["NEW"])}</strong>
        </div>
        <div className="stat">
          <span>跟进中</span>
          <strong>{count(["CONTACTED", "IN_PROGRESS"])}</strong>
        </div>
        <div className="stat">
          <span>已完成 / 关闭</span>
          <strong>{count(["COMPLETED", "CLOSED"])}</strong>
        </div>
      </div>
      <section className="panel">
        <form action="/admin" className="admin-filters">
          <div className="field">
            <label htmlFor="q">搜索需求编号</label>
            <input
              name="q"
              id="q"
              defaultValue={q}
              maxLength={100}
              placeholder="输入需求编号"
            />
          </div>
          <div className="field">
            <label htmlFor="status">处理状态</label>
            <select id="status" name="status" defaultValue={status || ""}>
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">筛选</Button>
        </form>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">咨询需求，共 {total} 条</caption>
            <thead>
              <tr>
                <th>需求编号</th>
                <th>服务 / 场景</th>
                <th>联系方式</th>
                <th>状态</th>
                <th>提交时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.number}</td>
                  <td>
                    {item.service}
                    <br />
                    <span className="muted">{item.scene}</span>
                  </td>
                  <td>{item.contact}</td>
                  <td>
                    <span className="pill">{statusLabels[item.status]}</span>
                  </td>
                  <td>
                    {item.createdAt.toLocaleString("zh-CN", {
                      timeZone: "Asia/Shanghai",
                    })}
                  </td>
                  <td>
                    <Link
                      className="text-link"
                      href={`/admin/requests/${item.id}`}
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <div className="admin-empty">
            {q || status
              ? "没有符合筛选条件的需求。"
              : "还没有收到需求。用户提交后会显示在这里。"}
          </div>
        )}
        <div className="pagination">
          <span>
            共 {total} 条 · 第 {page} 页
          </span>
          <div>
            {page > 1 && <Link href={pageHref(page - 1)}>上一页</Link>}
            {page * 25 < total && <Link href={pageHref(page + 1)}>下一页</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
