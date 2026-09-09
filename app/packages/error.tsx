"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function CatalogError({ reset }: { reset: () => void }) {
  return (
    <div className="container page-shell">
      <section className="panel">
        <h1>套餐暂时无法加载</h1>
        <p>请稍后重试，或先查看服务介绍。</p>
        <div className="result-actions">
          <Button onClick={reset}>重新加载</Button>
          <Button asChild variant="outline">
            <Link href="/#services">查看服务介绍</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
