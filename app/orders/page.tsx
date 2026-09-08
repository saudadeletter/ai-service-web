import type { Metadata } from "next";
import Link from "next/link";
import { OrderLookup } from "@/components/order-lookup";
export const metadata: Metadata = { title: "订单查询" };
export default function OrdersPage() {
  return (
    <div className="container page-shell">
      <div className="order-shell">
        <div className="breadcrumbs">
          <Link href="/">首页</Link>
          <span>/</span>
          <span>订单查询</span>
        </div>
        <div className="page-intro">
          <p className="eyebrow">FOLLOW THE PROGRESS</p>
          <h1>进展，心里有数。</h1>
          <p>查看服务处理流程与交付状态。</p>
        </div>
        <div className="notice">
          当前仅支持演示订单，无真实客户数据。正式订单查询将在身份验证与后台接通后开放。
        </div>
        <OrderLookup />
      </div>
    </div>
  );
}
