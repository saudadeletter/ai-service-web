"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
export function OrderLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<"idle" | "demo" | "missing">("idle");
  function lookup(e: React.FormEvent) {
    e.preventDefault();
    setResult(query.trim().toUpperCase() === "DEMO-2026" ? "demo" : "missing");
  }
  return (
    <>
      <section className="panel">
        <h2>输入订单编号</h2>
        <form className="lookup-form" onSubmit={lookup}>
          <label className="sr-only" htmlFor="order-number">
            订单编号
          </label>
          <input
            className="lookup-input"
            id="order-number"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResult("idle");
            }}
            placeholder="例如 DEMO-2026"
            required
          />
          <Button type="submit">
            <Search size={17} /> 查询进度
          </Button>
        </form>
        <p className="demo-hint">
          体验查询：
          <button
            className="inline-button"
            onClick={() => {
              setQuery("DEMO-2026");
              setResult("demo");
            }}
          >
            查看演示订单 DEMO-2026
          </button>
        </p>
      </section>
      <div aria-live="polite">
        {result === "missing" && (
          <div className="error-box">
            当前只开放 DEMO-2026
            演示订单，尚未连接真实订单系统。请使用演示编号体验。
          </div>
        )}
        {result === "demo" && (
          <section className="panel order-result">
            <div className="order-head">
              <div>
                <h2>期末复习助手</h2>
                <p>DEMO-2026 · 虚构演示订单</p>
              </div>
              <span className="pill">定制中</span>
            </div>
            <ol className="timeline">
              <li className="done">
                <strong>需求已确认</strong>
                <p>梳理知识框架、规划复习任务与自测练习。</p>
              </li>
              <li className="done">
                <strong>方案已确认</strong>
                <p>交付物与使用方式已完成沟通（演示）。</p>
              </li>
              <li className="active" aria-current="step">
                <strong>正在定制</strong>
                <p>配置助手并整理使用示例（演示）。</p>
              </li>
              <li>
                <strong>等待交付</strong>
                <p>交付说明与核验结果将在这里展示。</p>
              </li>
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
