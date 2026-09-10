import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function PackageNotFound() {
  return (
    <div className="container empty-page">
      <h1>这个套餐暂时无法查看。</h1>
      <p className="muted">
        套餐可能已下架，或链接有误。可以查看当前可咨询的服务。
      </p>
      <Button asChild>
        <Link href="/packages">返回服务套餐</Link>
      </Button>
    </div>
  );
}
