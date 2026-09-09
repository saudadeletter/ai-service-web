import Link from "next/link";
export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="管理导航">
      <Link href="/admin">咨询需求</Link>
      <Link href="/admin/orders">订单管理</Link>
      <Link href="/admin/packages">套餐管理</Link>
    </nav>
  );
}
