"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/admin/overview", "工作台"],
  ["/admin", "咨询需求"],
  ["/admin/orders", "订单管理"],
  ["/admin/packages", "套餐管理"],
] as const;
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="管理导航">
      {links.map(([href, label]) => {
        const active =
          href === "/admin"
            ? pathname === href || pathname.startsWith("/admin/requests/")
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
