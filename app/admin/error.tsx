"use client";
import { Button } from "@/components/ui/button";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="container page-shell">
      <div className="panel">
        <h1>暂时无法加载管理页面。</h1>
        <p className="muted">
          请稍后重试。如果持续出现，请检查站点的数据库连接和管理服务配置。
        </p>
        <div className="result-actions">
          <Button onClick={reset}>重新加载</Button>
        </div>
      </div>
    </div>
  );
}
