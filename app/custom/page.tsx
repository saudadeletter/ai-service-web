import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileText, MessageCircle } from "lucide-react";
import { RequestForm } from "@/components/request-form";

export const metadata: Metadata = { title: "说说你的需求" };
export default function CustomPage() {
  return (
    <div className="container page-shell">
      <div className="breadcrumbs">
        <Link href="/">首页</Link>
        <span>/</span>
        <span>整理需求</span>
      </div>
      <div className="page-intro">
        <p className="eyebrow">YOUR NEXT SMALL STEP</p>
        <h1>你想让 AI 帮你做什么？</h1>
        <p>从一个具体的问题开始。先把需求整理清楚，再讨论方案和报价。</p>
      </div>
      <div className="form-layout">
        <div>
          <div className="notice">
            当前为页面演示。填写内容仅在当前页面处理，不会发送给商家或创建真实订单。生成后请复制或下载需求单。
          </div>
          <Suspense fallback={<p>正在准备需求表单…</p>}>
            <RequestForm />
          </Suspense>
        </div>
        <aside className="panel form-aside">
          <h2>不用懂技术，讲清这三点。</h2>
          <div className="aside-items">
            {[
              [
                MessageCircle,
                "现在遇到了什么麻烦？",
                "例如：课程资料太散，不知道复习顺序。",
              ],
              [
                FileText,
                "希望最后拿到什么？",
                "例如：一份知识框架、一周复习计划。",
              ],
              [
                CheckCircle2,
                "有什么时间与使用要求？",
                "例如：下周考试，希望在手机上操作。",
              ],
            ].map(([Icon, title, text], i) => {
              const I = Icon as typeof FileText;
              return (
                <div className="aside-item" key={i}>
                  <I size={20} />
                  <div>
                    <strong>{title as string}</strong>
                    <p>{text as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <h3>关于报价</h3>
          <p>根据任务范围、使用平台与交付要求确认。提交需求不代表同意购买。</p>
        </aside>
      </div>
    </div>
  );
}
