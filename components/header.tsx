"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Cat, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  ["服务项目", "/#services"],
  ["服务套餐", "/packages"],
  ["进度查询", "/orders"],
  ["常见问题", "/help"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          className="brand"
          href="/"
          onClick={() => setOpen(false)}
          aria-label="AI 小站首页"
        >
          <span className="brand-mark">
            <Cat size={25} strokeWidth={1.8} />
          </span>
          <span>
            AI 小站<span className="brand-caption">你的校园 AI 搭子</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">
          {links.map(([label, href]) => (
            <Link
              href={href}
              key={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm" className="header-cta">
          <Link href="/custom">说说你的需求</Link>
        </Button>
        <button
          className="menu-toggle"
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="手机导航">
          {links.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
