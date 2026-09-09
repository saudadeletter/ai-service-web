"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, Download, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scenarios } from "@/lib/content";
import {
  budgetOptions,
  sceneOptions,
  serviceOptions,
  timelineOptions,
} from "@/lib/request-options";
import { api } from "@/lib/client-api";

function newLookupKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function RequestForm() {
  const params = useSearchParams();
  const requestedScene = scenarios.find((s) => s.title === params.get("scene"));
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<{
    number: string;
    lookupKey: string;
  } | null>(null);
  const [contactType, setContactType] = useState("email");
  const resultRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  // Reuse the key on an unchanged retry, including when the server response was lost.
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  function values() {
    const data = new FormData(formRef.current!);
    return {
      service: String(data.get("service")),
      scene: String(data.get("scene")),
      description: String(data.get("description")).trim(),
      timeline: String(data.get("timeline")),
      budget: String(data.get("budget")),
      contactType: String(data.get("contactType")),
      contact: String(data.get("contact")).trim(),
      consent: data.get("consent") === "on",
    };
  }
  function text(data: ReturnType<typeof values>) {
    return [
      `服务类型：${data.service}`,
      `使用场景：${data.scene}`,
      `希望完成的任务：${data.description}`,
      `希望完成时间：${data.timeline}`,
      `预算范围：${data.budget}`,
    ].join("\n");
  }
  function draft() {
    const data = values();
    if (data.description.length < 10) {
      setError("请至少用 10 个字符描述需求，再生成草稿。");
      return;
    }
    setError("");
    setSummary(`AI 小站 · 需求草稿（未提交）\n\n${text(data)}`);
    setFeedback("草稿仅在当前页面生成，尚未发送给管理员。");
    requestAnimationFrame(() => resultRef.current?.focus());
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || receipt) return;
    // Read the form before disabling the fieldset, since disabled fields are excluded.
    const data = values();
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const payload = JSON.stringify(data);
      if (!attempt.current || attempt.current.payload !== payload)
        attempt.current = { payload, key: newLookupKey() };
      const lookupKey = attempt.current.key;
      const result = await api<{ number: string }>("/api/requests", {
        ...data,
        lookupKey,
      });
      setReceipt({ number: result.number, lookupKey });
      setSummary(
        `AI 小站 · 需求提交凭证\n需求编号：${result.number}\n查询码：${lookupKey}\n\n${text(data)}\n\n请妥善保管查询码；这份凭证不代表付款或成交。`,
      );
      setFeedback(
        "需求已提交。请复制或下载凭证，刷新页面后查询码不会再次显示。",
      );
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试。");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setFeedback("已复制，请保存好凭证和查询码。");
    } catch {
      setFeedback("浏览器未允许复制，请手动选择文字，或下载文本。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + summary], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = receipt ? `${receipt.number}.txt` : "ai-service-request.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("已发起下载，请检查浏览器下载列表。");
  }
  return (
    <>
      <form className="panel" ref={formRef} onSubmit={submit}>
        <fieldset disabled={pending || !!receipt} className="plain-fieldset">
          <div className="field">
            <label htmlFor="service">需要哪类服务？</label>
            <select
              id="service"
              name="service"
              defaultValue={
                params.get("service") === "subscription"
                  ? "ChatGPT 订阅协助"
                  : serviceOptions[0]
              }
            >
              {serviceOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scene">主要用在什么场景？</label>
            <select
              id="scene"
              name="scene"
              defaultValue={
                requestedScene?.title ||
                (params.get("service") === "subscription"
                  ? "订阅咨询"
                  : "其他 / 还没想好")
              }
            >
              {sceneOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="description">具体想完成什么？ *</label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              maxLength={2000}
              defaultValue={requestedScene?.prompt || ""}
              placeholder="例如：我有一门课的 8 份课件，希望整理知识框架，并安排 7 天复习计划。"
              aria-describedby="description-help"
            />
            <small id="description-help">
              10–2000 个字符。请勿填写账号密码、验证码或其他敏感资料。
            </small>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="timeline">希望什么时候完成？</label>
              <select id="timeline" name="timeline">
                {timelineOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="budget">预算范围（仅作需求参考）</label>
              <select id="budget" name="budget">
                {budgetOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="contactType">联系方式</label>
              <select
                id="contactType"
                name="contactType"
                value={contactType}
                onChange={(e) => setContactType(e.target.value)}
              >
                <option value="email">邮箱</option>
                <option value="wechat">微信号</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="contact">
                {contactType === "email" ? "邮箱地址" : "微信号"} *
              </label>
              <input
                id="contact"
                name="contact"
                type={contactType === "email" ? "email" : "text"}
                autoComplete={contactType === "email" ? "email" : "off"}
                required
                minLength={3}
                maxLength={120}
                placeholder={
                  contactType === "email"
                    ? "yourname@example.com"
                    : "填写微信号，非昵称"
                }
              />
            </div>
          </div>
          <label className="checkbox-field">
            <input name="consent" type="checkbox" required />
            <span>
              我同意将需求与联系方式提交给管理员，用于沟通和处理本次咨询。提交不会产生费用。
              <Link className="text-link" href="/help#privacy" target="_blank">
                查看信息使用说明
              </Link>
            </span>
          </label>
          <div className="result-actions">
            <Button type="submit">
              <Send size={17} />
              {pending ? "正在提交…" : receipt ? "已提交" : "提交需求"}
            </Button>
            <Button type="button" variant="outline" onClick={draft}>
              <FileText size={17} />
              仅生成本地草稿
            </Button>
          </div>
        </fieldset>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
      </form>
      {summary && (
        <section
          ref={resultRef}
          tabIndex={-1}
          className="panel result-panel"
          aria-label={receipt ? "需求提交凭证" : "需求草稿"}
        >
          <h2>
            {receipt ? "需求已收到，保存好查询凭证。" : "需求草稿整理好了。"}
          </h2>
          <p>
            {receipt
              ? "管理员会按你提供的联系方式与你沟通。使用需求编号和查询码可以查看后续进度。"
              : "草稿未提交，可继续修改表单后正式提交。"}
          </p>
          <pre>{summary}</pre>
          <div className="result-actions">
            <Button onClick={copy} size="sm">
              <Copy size={16} />
              复制{receipt ? "凭证" : "草稿"}
            </Button>
            <Button onClick={download} variant="outline" size="sm">
              <Download size={16} />
              下载文本
            </Button>
            {receipt && (
              <Button asChild variant="outline" size="sm">
                <Link href="/orders">查看进度</Link>
              </Button>
            )}
          </div>
          <div className="feedback" role="status">
            {feedback}
          </div>
        </section>
      )}
    </>
  );
}
