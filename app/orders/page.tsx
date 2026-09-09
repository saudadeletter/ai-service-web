import type { Metadata } from "next";
import Link from "next/link";
import { OrderLookup } from "@/components/order-lookup";
export const metadata: Metadata = { title: "需求进度查询" };
export default function OrdersPage() {
  return (
    <div className="container page-shell">
      <div className="order-shell">
        <div className="breadcrumbs">
          <Link href="/">首页</Link>
          <span>/</span>
          <span>进度查询</span>
        </div>
        <div className="page-intro">
          <p className="eyebrow">FOLLOW THE PROGRESS</p>
          <h1>进展，心里有数。</h1>
          <p>凭需求编号和查询码，查看最新处理进度。</p>
        </div>
        <div className="notice">
          查询码相当于这份需求的查看凭证，请妥善保管。此处不展示联系方式与管理员内部备注。
        </div>
        <OrderLookup />
      </div>
    </div>
  );
}
