"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { statusLabels, type Status } from "@/lib/request-options";
import { api } from "@/lib/client-api";
export function RequestEditor(props: {
  id: string;
  status: Status;
  publicNote: string;
  internalNote: string;
  revision: number;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(props.revision);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ revision: number }>(
        `/api/admin/requests/${props.id}`,
        {
          status: data.get("status"),
          publicNote: data.get("publicNote"),
          internalNote: data.get("internalNote"),
          revision,
        },
        "PATCH",
      );
      setRevision(result.revision);
      setMessage("已保存，用户可查询最新状态与处理说明。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试。");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="panel" onSubmit={save}>
      <h2>更新处理进度</h2>
      <fieldset className="plain-fieldset" disabled={pending}>
        <div className="field">
          <label htmlFor="edit-status">处理状态</label>
          <select name="status" id="edit-status" defaultValue={props.status}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="publicNote">给用户看的处理说明</label>
          <textarea
            id="publicNote"
            name="publicNote"
            maxLength={2000}
            defaultValue={props.publicNote}
            placeholder="例如：已收到需求，正在梳理复习资料。"
          />
          <small>用户凭查询码可以看到此内容，请勿填写内部信息。</small>
        </div>
        <div className="field">
          <label htmlFor="internalNote">内部备注</label>
          <textarea
            id="internalNote"
            name="internalNote"
            maxLength={4000}
            defaultValue={props.internalNote}
            placeholder="仅管理员可见，用于记录沟通情况。"
          />
        </div>
        <Button type="submit">{pending ? "正在保存…" : "保存进度"}</Button>
      </fieldset>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </form>
  );
}
