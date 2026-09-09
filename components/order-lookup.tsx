"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { statusLabels, type PublicRequest } from "@/lib/request-options";
export function OrderLookup() {
  const [result, setResult] = useState<PublicRequest | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demo, setDemo] = useState(false);
  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    setDemo(false);
    const data = new FormData(e.currentTarget);
    try {
      setResult(
        await api<PublicRequest>("/api/requests/lookup", {
          number: String(data.get("number")).trim(),
          lookupKey: String(data.get("lookupKey")).trim(),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败。");
    } finally {
      setPending(false);
    }
  }
  function showDemo() {
    setError("");
    setDemo(true);
    setResult({
      number: "DEMO-2026",
      service: "专属 AI 助手定制",
      scene: "期末复习",
      status: "IN_PROGRESS",
      publicNote:
        "正在整理复习计划与使用示例。这是一份虚构需求，仅用于展示查询效果。",
      createdAt: "",
      updatedAt: "",
    });
  }
  return (
    <>
      <section className="panel">
        <h2>查看我的需求进度</h2>
        <form onSubmit={lookup}>
          <div className="field">
            <label htmlFor="request-number">需求编号</label>
            <input
              id="request-number"
              name="number"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              placeholder="AI-20260908-…"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="lookup-key">查询码</label>
            <input
              id="lookup-key"
              name="lookupKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              minLength={48}
              maxLength={48}
              required
              placeholder="提交成功后获得的 48 位查询码"
            />
            <small>查询码在提交凭证中。请不要将它发到公开群聊。</small>
          </div>
          <Button type="submit" disabled={pending}>
            <Search size={17} />
            {pending ? "正在查询…" : "查询进度"}
          </Button>
        </form>
        <p className="demo-hint">
          还没有需求？
          <button
            disabled={pending}
            className="inline-button"
            onClick={showDemo}
          >
            查看演示 DEMO-2026
          </button>
        </p>
      </section>
      <div aria-live="polite">
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {result && (
          <section className="panel order-result">
            <div className="order-head">
              <div>
                <h2>{result.service}</h2>
                <p>
                  {result.number}
                  {demo ? " · 虚构示例" : ""}
                </p>
              </div>
              <span className="pill">{statusLabels[result.status]}</span>
            </div>
            <div className="metadata-row">
              <span>使用场景</span>
              <span>{result.scene}</span>
            </div>
            {result.createdAt && (
              <div className="metadata-row">
                <span>提交时间</span>
                <span>
                  {new Date(result.createdAt).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
            {result.updatedAt && (
              <div className="metadata-row">
                <span>最近更新</span>
                <span>
                  {new Date(result.updatedAt).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
            <h3>处理说明</h3>
            <p className="preserve-text">
              {result.publicNote || "需求已收到，等待管理员与你沟通。"}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
