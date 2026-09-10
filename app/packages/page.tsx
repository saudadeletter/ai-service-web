import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Search, ArrowUpRight } from "lucide-react";
import {
  catalogFilters,
  catalogHref,
  catalogServices,
  catalogSorts,
  packageConsultationHref,
  type CatalogParams,
} from "@/lib/catalog";
import { db } from "@/lib/server/db";
import { publicPackageFields } from "@/lib/server/commerce";
import { money } from "@/lib/order-options";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "服务套餐" };
export default async function Packages({
  searchParams,
}: {
  searchParams: Promise<CatalogParams>;
}) {
  const filters = catalogFilters(await searchParams);
  // Treat SQL LIKE metacharacters as literal search text.
  const keyword = filters.q.replace(/[\\%_]/g, "\\$&");
  const where: Prisma.ServicePackageWhereInput = {
    isActive: true,
    ...(filters.service ? { service: catalogServices[filters.service] } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const total = await db().servicePackage.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / 12));
  const page = Math.min(filters.page, totalPages);
  const orderBy: Prisma.ServicePackageOrderByWithRelationInput[] =
    filters.sort === "newest"
      ? [{ createdAt: "desc" }, { id: "desc" }]
      : [
          { priceCents: filters.sort === "price-asc" ? "asc" : "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ];
  const items = await db().servicePackage.findMany({
    where,
    select: publicPackageFields,
    orderBy,
    skip: (page - 1) * 12,
    take: 12,
  });
  const filtered = !!(filters.q || filters.service);
  return (
    <div className="container page-shell catalog-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">按需求选择，先沟通再确认</p>
          <h1>找到适合你的服务</h1>
          <p>
            以下为套餐参考价，具体范围与成交价会在沟通后确认。咨询不会产生费用。
          </p>
        </div>
      </div>
      <form
        action="/packages"
        method="get"
        className="catalog-filters"
        role="search"
        aria-label="查找服务套餐"
        key={catalogHref(filters, page)}
      >
        <div className="field catalog-search">
          <label htmlFor="catalog-keyword">关键词</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="catalog-keyword"
              name="q"
              type="search"
              maxLength={80}
              defaultValue={filters.q}
              placeholder="搜索套餐名称或需求，例如：复习"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="catalog-service">服务类型</label>
          <select
            id="catalog-service"
            name="service"
            defaultValue={filters.service}
          >
            <option value="">全部服务</option>
            {Object.entries(catalogServices).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="catalog-sort">排序方式</label>
          <select id="catalog-sort" name="sort" defaultValue={filters.sort}>
            {Object.entries(catalogSorts).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">查找套餐</Button>
      </form>
      <div className="catalog-results">
        <p>
          找到 <strong>{total}</strong> 个套餐
          {filters.q && <> · 关键词「{filters.q}」</>}
        </p>
        {(filtered || filters.sort !== "newest") && (
          <Link href="/packages" className="text-link">
            重置筛选
          </Link>
        )}
      </div>
      <div className="catalog-grid">
        {items.map((p) => (
          <article className="panel" key={p.id}>
            <span className="pill">{p.service}</span>
            <h2>
              <Link href={`/packages/${p.id}`}>{p.name}</Link>
            </h2>
            <p className="catalog-price">
              <strong className="catalog-price-amount">
                {money(p.priceCents)}
              </strong>
              <small>/ 参考价</small>
            </p>
            <p className="preserve-text catalog-excerpt">{p.description}</p>
            <div className="catalog-card-actions">
              <Link href={`/packages/${p.id}`} className="text-link">
                查看详情 <ArrowUpRight size={16} />
              </Link>
              <Button asChild>
                <Link href={packageConsultationHref(p)}>咨询这个套餐</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <section className="panel admin-empty">
          <h2>{filtered ? "暂时没有符合条件的套餐" : "套餐正在整理中"}</h2>
          <p>
            {filtered
              ? "试试更简短的关键词，或查看全部服务。也可以直接告诉我们你的需求。"
              : "可以先告诉我们你的使用场景，我们会与你沟通适合的方案。"}
          </p>
          <div className="result-actions catalog-empty-actions">
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/packages">查看全部套餐</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/custom">说说我的需求</Link>
            </Button>
          </div>
        </section>
      )}
      {total > 0 && (
        <nav className="pagination" aria-label="套餐分页">
          <span>
            第 {page} / {totalPages} 页
          </span>
          <div>
            {page > 1 && (
              <Link href={catalogHref(filters, page - 1)} rel="prev">
                上一页
              </Link>
            )}
            {page < totalPages && (
              <Link href={catalogHref(filters, page + 1)} rel="next">
                下一页
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
