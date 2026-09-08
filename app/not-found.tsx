import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="container empty-page">
      <span className="eyebrow" style={{ justifyContent: "center" }}>
        404
      </span>
      <h1>这个页面暂时找不到。</h1>
      <p className="muted">可以回到首页，查看现有服务。</p>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
