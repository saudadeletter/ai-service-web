import Link from "next/link";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { money } from "@/lib/order-options";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "套餐管理" };
export default async function Packages({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  const [items, total] = await Promise.all([
    db().servicePackage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    db().servicePackage.count(),
  ]);
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">服务内容与参考价</p>
          <h1>套餐管理</h1>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">创建套餐</Link>
        </Button>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">套餐列表</caption>
            <thead>
              <tr>
                <th>套餐名称</th>
                <th>服务</th>
                <th>参考价</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.service}</td>
                  <td>{money(p.priceCents)}</td>
                  <td>{p.isActive ? "已上架" : "未上架"}</td>
                  <td>
                    <Link
                      className="text-link"
                      href={`/admin/packages/${p.id}`}
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <p className="admin-empty">
            还没有套餐。创建并上架后，用户可查看套餐，你也可据此生成订单。
          </p>
        )}
        <div className="pagination">
          <span>
            共 {total} 个 · 第 {page} 页
          </span>
          <div>
            {page > 1 && <Link href={`?page=${page - 1}`}>上一页</Link>}
            {page * 25 < total && (
              <Link href={`?page=${page + 1}`}>下一页</Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
