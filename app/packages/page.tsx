import Link from "next/link";
import { db } from "@/lib/server/db";
import { publicPackageFields } from "@/lib/server/commerce";
import { money } from "@/lib/order-options";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "服务套餐" };
export default async function Packages({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  const [items, total] = await Promise.all([
    db().servicePackage.findMany({
      where: { isActive: true },
      select: publicPackageFields,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 12,
      take: 12,
    }),
    db().servicePackage.count({ where: { isActive: true } }),
  ]);
  return (
    <div className="container page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">按需求选择，先沟通再确认</p>
          <h1>找到适合你的服务</h1>
          <p>
            以下为套餐参考价，具体范围与成交价会在沟通后确认。咨询不会产生费用。
          </p>
        </div>
      </div>
      <div className="catalog-grid">
        {items.map((p) => (
          <article className="panel" key={p.id}>
            <span className="pill">{p.service}</span>
            <h2>{p.name}</h2>
            <p className="catalog-price">
              {money(p.priceCents)}
              <small> / 参考价</small>
            </p>
            <p className="preserve-text">{p.description}</p>
            <Button asChild>
              <Link
                href={`/custom?${new URLSearchParams({ service: p.service === "ChatGPT 订阅协助" ? "subscription" : "custom", package: p.name })}`}
              >
                咨询这个套餐
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {!items.length && (
        <section className="panel admin-empty">
          <h2>套餐正在整理中</h2>
          <p>可以先告诉我们你的使用场景，我们会与你沟通适合的方案。</p>
          <Button asChild>
            <Link href="/custom">说说我的需求</Link>
          </Button>
        </section>
      )}
      <div className="pagination">
        <span>第 {page} 页</span>
        <div>
          {page > 1 && <Link href={`?page=${page - 1}`}>上一页</Link>}
          {page * 12 < total && <Link href={`?page=${page + 1}`}>下一页</Link>}
        </div>
      </div>
    </div>
  );
}
