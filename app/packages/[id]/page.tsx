import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/server/db";
import { publicPackageFields } from "@/lib/server/commerce";
import { packageConsultationHref } from "@/lib/catalog";
import { money } from "@/lib/order-options";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const getPackage = cache(async (id: string) => {
  if (!id || id.length > 80) return null;
  return db().servicePackage.findFirst({
    where: { id, isActive: true },
    select: publicPackageFields,
  });
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPackage((await params).id);
  return { title: item?.name || "套餐暂不可用" };
}
export default async function PackageDetail({ params }: Props) {
  const item = await getPackage((await params).id);
  if (!item) notFound();
  return (
    <div className="container page-shell">
      <nav className="breadcrumbs" aria-label="当前位置">
        <Link href="/">首页</Link>
        <span>/</span>
        <Link href="/packages">服务套餐</Link>
        <span>/</span>
        <span>套餐详情</span>
      </nav>
      <div className="package-detail-grid">
        <article className="panel package-description">
          <span className="pill">{item.service}</span>
          <h1>{item.name}</h1>
          <p className="eyebrow">这个套餐可以帮你做什么</p>
          <div className="preserve-text">{item.description}</div>
          <Link className="text-link" href="/packages">
            继续浏览其他套餐 <ArrowUpRight size={16} />
          </Link>
        </article>
        <aside className="panel package-summary">
          <p className="eyebrow">先了解，再决定</p>
          <p className="catalog-price">
            <strong className="catalog-price-amount">
              {money(item.priceCents)}
            </strong>
            <small>/ 参考价</small>
          </p>
          <p>具体成交价与交付范围，以沟通后双方确认的方案为准。</p>
          <ul className="check-list">
            {[
              "确认使用平台与适用条件",
              "确认交付内容与办理时间",
              "确认费用与售后约定",
            ].map((text) => (
              <li key={text}>
                <Check size={17} />
                {text}
              </li>
            ))}
          </ul>
          <Button asChild>
            <Link href={packageConsultationHref(item)}>
              咨询这个套餐 <ArrowUpRight size={17} />
            </Link>
          </Button>
          <p className="package-consultation-note">
            进入咨询后会带入套餐名称，提交需求不会产生费用。
          </p>
          <Link href="/help" className="text-link">
            查看服务说明
          </Link>
        </aside>
      </div>
    </div>
  );
}
