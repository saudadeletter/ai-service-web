"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, Download, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scenarios } from "@/lib/content";

export function RequestForm() {
  const params = useSearchParams();
  const requestedScene = scenarios.find((s) => s.title === params.get("scene"));
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState("");
  const resultRef = useRef<HTMLElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lines = [
      "AI 小站 · 咨询需求单",
      "（尚未提交，不是订单或付款凭证）",
      "",
      `服务类型：${data.get("service")}`,
      `使用场景：${data.get("scene")}`,
      `希望完成的任务：${String(data.get("description")).trim()}`,
      `希望完成时间：${data.get("timeline")}`,
      `预算范围：${data.get("budget")}`,
      "",
      "待沟通：使用平台、交付物、费用、交付时间与调整范围。",
    ];
    setSummary(lines.join("\n"));
    setFeedback("需求单已在当前页面生成。请复制或下载保存。");
    requestAnimationFrame(() => resultRef.current?.focus());
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setFeedback("已复制，可以粘贴到你使用的沟通工具。");
    } catch {
      setFeedback("浏览器未允许复制，请手动选择下方文字，或下载需求单。");
    }
  }
  function download() {
    const blob = new Blob(["\uFEFF" + summary], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-service-request.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("已发起下载，请检查浏览器下载列表。");
  }
  return (
    <>
      <form className="panel" onSubmit={submit}>
        <div className="field">
          <label htmlFor="service">需要哪类服务？</label>
          <select
            id="service"
            name="service"
            defaultValue={
              params.get("service") === "subscription"
                ? "ChatGPT 订阅协助"
                : "专属 AI 助手定制"
            }
          >
            <option>专属 AI 助手定制</option>
            <option>ChatGPT 订阅协助</option>
            <option>两项都想了解</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="scene">主要用在什么场景？</label>
          <select
            id="scene"
            name="scene"
            defaultValue={requestedScene?.title || "其他 / 还没想好"}
          >
            {scenarios.map((s) => (
              <option key={s.title}>{s.title}</option>
            ))}
            <option>订阅咨询</option>
            <option>其他 / 还没想好</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="description">
            具体想完成什么？ <span aria-hidden="true">*</span>
          </label>
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
              <option>先了解，不着急</option>
              <option>一周内</option>
              <option>两周内</option>
              <option>时间另行沟通</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget">预算范围（仅作需求参考）</label>
            <select id="budget" name="budget">
              <option>希望先了解报价</option>
              <option>100 元以内</option>
              <option>100–300 元</option>
              <option>300 元以上</option>
            </select>
          </div>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" required />
          <span>我了解这会生成一份本地需求单，不会提交订单或产生费用。</span>
        </label>
        <Button type="submit">
          生成需求单 <ArrowUpRight size={18} />
        </Button>
      </form>
      {summary && (
        <section
          ref={resultRef}
          tabIndex={-1}
          className="panel result-panel"
          aria-label="生成的需求单"
        >
          <h2>需求整理好了。</h2>
          <p>核对内容后，复制或下载保存。修改表单后可再次生成。</p>
          <pre>{summary}</pre>
          <div className="result-actions">
            <Button onClick={copy} size="sm">
              <Copy size={16} /> 复制需求单
            </Button>
            <Button onClick={download} variant="outline" size="sm">
              <Download size={16} /> 下载文本
            </Button>
          </div>
          <div className="feedback" role="status">
            {feedback}
          </div>
        </section>
      )}
    </>
  );
}
