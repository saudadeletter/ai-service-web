"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { serviceOptions } from "@/lib/request-options";
type Item = {
  id: string;
  name: string;
  service: string;
  description: string;
  priceCents: number;
  isActive: boolean;
  revision: number;
};
export function PackageForm({ item }: { item?: Item }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const createId = useRef<string | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = new FormData(e.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      createId.current ||= crypto.randomUUID();
      const result = await api<{ id: string }>(
        item ? `/api/admin/packages/${item.id}` : "/api/admin/packages",
        {
          name: form.get("name"),
          service: form.get("service"),
          description: form.get("description"),
          price: form.get("price"),
          isActive: form.get("isActive") === "on",
          ...(item ? { revision: item.revision } : { id: createId.current }),
        },
        item ? "PATCH" : "POST",
      );
      router.push(`/admin/packages/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="panel" onSubmit={save}>
      <fieldset className="plain-fieldset" disabled={pending}>
        <div className="field">
          <label htmlFor="package-name">套餐名称</label>
          <input
            id="package-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={item?.name}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="package-service">服务类型</label>
            <select
              id="package-service"
              name="service"
              defaultValue={item?.service}
            >
              {serviceOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="package-price">参考价格（元）</label>
            <input
              id="package-price"
              name="price"
              type="number"
              required
              min="0.01"
              max="100000"
              step="0.01"
              defaultValue={item ? (item.priceCents / 100).toFixed(2) : ""}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="package-description">套餐内容与范围</label>
          <textarea
            id="package-description"
            name="description"
            required
            minLength={10}
            maxLength={2000}
            defaultValue={item?.description}
          />
        </div>
        <label className="checkbox-field">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={item?.isActive}
          />
          <span>上架后展示在套餐页面，并可用于新订单。</span>
        </label>
        <Button type="submit">{pending ? "正在保存…" : "保存套餐"}</Button>
        <p className="muted">
          调价或下架只影响后续报价，历史订单保留原成交内容。
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </form>
  );
}
