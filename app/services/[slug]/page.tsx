import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";
import { services } from "@/lib/content";
import { ServiceIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  return { title: service?.name || "服务未找到" };
}
export default async function ServiceDetail({ params }: Props) {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  if (!service) notFound();
  const isCustom = slug === "custom-agent";
  return (
    <div className="container page-shell">
      <div className="breadcrumbs">
        <Link href="/">首页</Link>
        <span>/</span>
        <Link href="/#services">服务项目</Link>
        <span>/</span>
        <span>{service.name}</span>
      </div>
      <div className="page-intro">
        <p className="eyebrow">
          <ServiceIcon name={service.icon} size={19} /> {service.label}
        </p>
        <h1>{service.name}</h1>
        <p>{service.description}</p>
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>这项服务包含什么？</h2>
            <div className="detail-list">
              {service.includes.map((item) => (
                <div key={item}>
                  <Check size={19} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <h3>开始前，一起确认</h3>
            <p>{service.note}</p>
            <h3>{isCustom ? "交付内容要具体" : "办理条件先说清"}</h3>
            <p>
              {isCustom
                ? "助手配置、操作说明、示例任务和调整范围会写入交付约定。模型调用费、第三方平台订阅费是否包含，需要单独确认。"
                : "请先确认所需订阅、账号适用条件、服务方式和退款约定。网站不要求提供账号密码、验证码或登录令牌。"}
            </p>
          </section>
          <section className="panel">
            <h2>交付与售后</h2>
            <p>
              处理时间、完成标准、未能交付时的处理方式，以及支持期限，在确认订单前约定。本原型不展示未经确认的时效或退款承诺。
            </p>
          </section>
        </div>
        <aside className="panel quote-panel">
          <span className="pill">{service.label}</span>
          <div className="price">{service.price}</div>
          <p>先了解范围，再决定是否开始。</p>
          <div className="metadata-row">
            <span>预计交付</span>
            <span>{service.delivery}</span>
          </div>
          <div className="metadata-row">
            <span>当前状态</span>
            <span>接受需求咨询</span>
          </div>
          <Button asChild variant="dark">
            <Link href={isCustom ? "/custom" : "/custom?service=subscription"}>
              整理我的需求 <ArrowUpRight size={18} />
            </Link>
          </Button>
          <small>提交后可凭查询码跟进进度，尚未开通在线付款。</small>
        </aside>
      </div>
    </div>
  );
}
