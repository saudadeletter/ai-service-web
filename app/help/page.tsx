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
            你可以提交需求，由管理员沟通和处理，再凭查询码查看进度。“仅生成本地草稿”不会上传内容；正式提交后会保存到本站数据库。
          </p>
          <h3>服务开通前会补充</h3>
          <p>
            确认后的套餐与价格、具体交付及退款条款，以及支付和成交订单处理能力。
          </p>
          <h3 id="privacy">信息使用说明</h3>
          <p>
            提交时保存服务类型、场景、需求描述、时间与预算偏好、联系方式和同意时间，用于沟通及处理本次咨询。只有管理员可以查看联系方式和内部备注。查询码仅用于授权查看进度，数据库不保存原始查询码。请勿提供密码、验证码或无关个人信息。
          </p>
          <p>
            草稿与未提交的表单不会自动保存。需求结束后，你可以通过双方沟通渠道提出删除申请；请提供需求编号供管理员核对。管理员登录使用会话
            Cookie，不使用第三方统计。
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
