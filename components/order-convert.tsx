"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { money, type PackageOption } from "@/lib/order-options";
export function OrderConvert({
  requestId,
  revision,
  packages,
}: {
  requestId: string;
  revision: number;
  packages: PackageOption[];
}) {
  const router = useRouter();
  const [packageId, setPackageId] = useState(packages[0]?.id || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const selected = packages.find((p) => p.id === packageId);
  async function convert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current || !selected) return;
    const form = new FormData(e.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await api<{ id: string }>(
        `/api/admin/requests/${requestId}/order`,
        {
          requestRevision: revision,
          packageId,
          packageRevision: selected.revision,
          amount: form.get("amount"),
          deliveryTerms: form.get("deliveryTerms"),
          confirmed: form.get("confirmed") === "on",
        },
      );
      router.push(`/admin/orders/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="panel">
      <h2>确认成交并生成订单</h2>
      <p>与用户核对报价和交付范围后填写。生成订单不会发起扣款。</p>
      {!packages.length ? (
        <p>
          暂无上架套餐，先前往{" "}
          <Link className="text-link" href="/admin/packages/new">
            创建套餐
          </Link>
          。
        </p>
      ) : (
        <form onSubmit={convert}>
          <fieldset disabled={pending} className="plain-fieldset">
            <div className="field">
              <label htmlFor="conversion-package">选择套餐</label>
              <select
                id="conversion-package"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(p.priceCents)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="agreed-amount">确认成交价（元）</label>
              <input
                key={packageId}
                id="agreed-amount"
                name="amount"
                type="number"
                required
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={
                  selected ? (selected.priceCents / 100).toFixed(2) : ""
                }
              />
            </div>
            <div className="field">
              <label htmlFor="delivery-terms">交付约定（用户可见）</label>
              <textarea
                id="delivery-terms"
                name="deliveryTerms"
                required
                minLength={10}
                maxLength={2000}
                placeholder="写明交付内容、预计时间及双方确认的范围。"
              />
            </div>
            <label className="checkbox-field">
              <input name="confirmed" type="checkbox" required />
              <span>我已与用户核对套餐、成交价和交付约定。</span>
            </label>
            <Button type="submit">{pending ? "正在创建…" : "生成订单"}</Button>
          </fieldset>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
