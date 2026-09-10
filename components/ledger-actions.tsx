"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { orderStatusLabels, type OrderStatus } from "@/lib/order-options";
// Keep the token on a retry with the same explanation, including a lost response.
export function LedgerAction({
  orderId,
  entryId,
  revision,
  status,
  blocked,
}: {
  orderId: string;
  entryId?: string;
  revision: number;
  status: OrderStatus;
  blocked?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const correction = !!entryId;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = new FormData(e.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const data = {
        reason: form.get("reason"),
        confirmed: form.get("confirmed") === "on",
        ...(!correction ? { status: form.get("status") } : {}),
      };
      const payload = JSON.stringify(data);
      if (attempt.current?.payload !== payload)
        attempt.current = {
          payload,
          key: Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(""),
        };
      await api(
        correction
          ? `/api/admin/orders/${orderId}/money/${entryId}/correction`
          : `/api/admin/orders/${orderId}/review`,
        { ...data, revision, idempotencyKey: attempt.current.key },
      );
      router.push(`/admin/orders/${orderId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>{correction ? "登记冲正" : "完成账目复核"}</h2>
      <p>
        {correction
          ? "冲正将本笔登记移出有效合计，原始内容和更正原因继续保留。之后请补录正确记录并完成复核。"
          : "核对有效流水与实际交易后确认。保留已交付或已完成状态需有足额有效收款，保留已取消状态需退清已收金额；也可以退回待处理。"}
      </p>
      <fieldset className="plain-fieldset" disabled={pending || blocked}>
        {!correction && (
          <div className="field">
            <label htmlFor="review-status">复核后的订单状态</label>
            <select id="review-status" name="status" defaultValue={status}>
              {Array.from(
                new Set([status, "CONFIRMED", "CANCELLED"] as OrderStatus[]),
              ).map((s) => (
                <option value={s} key={s}>
                  {orderStatusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="ledger-reason">
            {correction ? "更正原因" : "复核结论"}（仅管理员可见）
          </label>
          <textarea
            id="ledger-reason"
            name="reason"
            required
            minLength={10}
            maxLength={2000}
            placeholder={
              correction
                ? "说明哪项登记有误，以及与实际交易核对的结果。"
                : "说明实际收退款与有效流水是否一致，以及保留或调整订单状态的原因。"
            }
          />
        </div>
        <label className="checkbox-field">
          <input name="confirmed" type="checkbox" required />
          <span>
            {correction
              ? "我确认这是登记错误，已核对实际交易；本操作不会执行退款。"
              : "我已核对实际交易、有效流水和订单状态，确认可以结束复核。"}
          </span>
        </label>
        <Button type="submit">
          {pending
            ? "正在保存…"
            : correction
              ? "确认冲正本笔登记"
              : "确认完成复核"}
        </Button>
      </fieldset>
      {blocked && (
        <p role="alert" className="error-box">
          冲正后退款将超过有效收款。请先核对相关退款登记；确属错误的退款需先冲正。
        </p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
