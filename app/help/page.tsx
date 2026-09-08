import type { Metadata } from "next";
import Link from "next/link";
import { faqs } from "@/lib/content";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "常见问题与服务说明" };
export default function HelpPage() {
  return (
    <div className="container page-shell">
      <div className="breadcrumbs">
        <Link href="/">首页</Link>
        <span>/</span>
        <span>服务说明</span>
      </div>
      <div className="page-intro">
        <p className="eyebrow">A LITTLE MORE CLARITY</p>
        <h1>开始之前，把事情说清楚。</h1>
        <p>了解服务范围、交付方式和当前网站能做的事情。</p>
      </div>
      <div className="help-grid">
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden="true">＋</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <aside className="panel">
          <h2>当前版本说明</h2>
          <p>
            这是可交互的页面原型。需求单在你的浏览器中生成，未上传；刷新页面后表单内容不保留。订单查询仅提供虚构示例。
          </p>
          <h3>服务开通前会补充</h3>
          <p>
            经营者联系信息、确认后的套餐与价格、具体交付及退款条款，以及真实订单处理能力。
          </p>
          <h3>数据与隐私</h3>
          <p>
            当前未接入统计、支付或账号系统。请不要在需求单中加入敏感资料。未来接入数据收集时，需要同步说明收集目的、保存期限与删除方式。
          </p>
          <div className="result-actions">
            <Button asChild>
              <Link href="/custom">整理我的需求</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
