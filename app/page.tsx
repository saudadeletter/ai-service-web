import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/icons";
import { faqs, scenarios, services } from "@/lib/content";

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-screen home-hero-screen">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={16} /> 为校园里的每一个「不会」准备
            </div>
            <h1>
              把 AI 用起来，
              <br />
              <span>把时间省下来。</span>
            </h1>
            <p className="hero-description">
              想用 ChatGPT，不知道从哪开始？
              <br />
              从订阅协助到专属助手，找到适合你的 AI 用法。
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="#services">
                  看看能帮我什么 <ArrowUpRight size={18} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/custom">我想定制助手</Link>
              </Button>
            </div>
            <div className="hero-points">
              <span>
                <Check size={16} /> 先讲清需求
              </span>
              <span>
                <Check size={16} /> 再确认报价
              </span>
              <span>
                <Check size={16} /> 约定交付内容
              </span>
            </div>
          </div>
          <div className="hero-board">
            <div className="board-heading">
              <span className="tiny-label">今天，给自己减点负</span>
              <span className="board-index">01 / 04</span>
            </div>
            <div className="board-title">
              <ServiceIcon name="book" size={32} />
              <h2>
                期末复习
                <br />
                有个新思路。
              </h2>
            </div>
            <div className="message message-user">
              课件有点多，不知道怎么复习……
            </div>
            <div className="message message-agent">
              <span className="message-author">
                <Sparkles size={16} /> 复习助手 · 能做什么
              </span>
              <p>先整理知识框架，再把复习拆成每天的小任务。</p>
              <div className="mini-tasks">
                <span>
                  <Check size={15} /> 归纳知识点
                </span>
                <span>
                  <Check size={15} /> 制定复习计划
                </span>
                <span>
                  <Check size={15} /> 生成自测练习
                </span>
              </div>
            </div>
            <div className="board-bottom">
              <span>使用场景示意</span>
              <Link href="/custom?scene=期末复习">
                定制我的复习助手 <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <div className="intro-strip">
          <div className="container">
            <span>少一点摸索，多一点进展。</span>
            <span>学习 / 求职 / 创作 / 日常效率</span>
            <ArrowDown size={19} />
          </div>
        </div>
      </div>
      <section id="services" className="section container home-screen">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHAT WE CAN HELP</p>
            <h2>从这里，开始用好 AI。</h2>
          </div>
          <p>
            你负责说出问题，
            <br />
            我们一起确认解决方式。
          </p>
        </div>
        <div className="service-grid">
          {services.map((service, i) => (
            <article
              className={`service-card ${i === 1 ? "service-card-accent" : ""}`}
              key={service.slug}
            >
              <div className="card-top">
                <span className="icon-box">
                  <ServiceIcon name={service.icon} size={28} />
                </span>
                <span className="pill">{service.label}</span>
              </div>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <ul className="check-list">
                {service.includes.map((item) => (
                  <li key={item}>
                    <Check size={17} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="service-card-bottom">
                <span>
                  <strong>{service.price}</strong>
                  <small>服务范围确认后再决定</small>
                </span>
                <Button variant={i === 1 ? "dark" : "outline"} asChild>
                  <Link href={`/services/${service.slug}`}>
                    了解详情 <ArrowUpRight size={17} />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="scenarios-section home-screen">
        <div className="section container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MADE FOR YOUR EVERYDAY</p>
              <h2>这些时刻，AI 可以搭把手。</h2>
            </div>
            <Link href="/custom" className="text-link">
              说说我的场景 <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="scenario-grid">
            {scenarios.map((s, i) => (
              <Link
                href={`/custom?scene=${encodeURIComponent(s.title)}`}
                className="scenario-card"
                key={s.title}
              >
                <div className="scenario-top">
                  <ServiceIcon name={s.icon} size={26} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{s.title}</h3>
                <p className="scenario-question">{s.text}</p>
                <p>{s.detail}</p>
                <span className="scenario-link">
                  了解定制 <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
          </div>
          <p className="section-note">
            场景示例用于说明定制方向；AI 输出需要你检查、判断与修改。
          </p>
        </div>
      </section>
      <section className="section container home-screen">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>流程简单，事情说清楚。</h2>
          </div>
        </div>
        <div className="steps">
          {[
            ["选择服务", "找到适合的方向，说明想解决的问题。"],
            ["确认方案", "沟通范围、费用、交付时间与售后约定。"],
            ["开始处理", "确认订单后，按约定的方案办理或定制。"],
            ["交付与上手", "核验结果，拿到操作说明和使用示例。"],
          ].map(([title, text], i) => (
            <article key={title}>
              <span className="step-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section container faq-section home-screen">
        <div>
          <p className="eyebrow">BEFORE YOU START</p>
          <h2>你可能还想问。</h2>
          <p className="muted">
            价格、交付、使用方式，
            <br />
            都值得在开始前说清楚。
          </p>
          <Link href="/help" className="text-link">
            查看服务说明 <ArrowUpRight size={17} />
          </Link>
        </div>
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
      </section>
      <section className="container">
        <div className="closing-banner">
          <div>
            <span className="eyebrow">START WITH ONE SMALL THING</span>
            <h2>先从一件想省心的小事开始。</h2>
            <p>不用写专业需求，把你遇到的麻烦讲清楚就好。</p>
          </div>
          <Button variant="dark" asChild>
            <Link href="/custom">
              说说我的需求 <ArrowUpRight size={18} />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
