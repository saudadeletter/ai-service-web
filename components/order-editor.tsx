"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import {
  nextOrderStatuses,
  orderStatusLabels,
  type OrderStatus,
} from "@/lib/order-options";
export function OrderEditor({
  id,
  revision,
  status,
  publicNote,
  deliveryNote,
  needsReview,
}: {
  id: string;
  revision: number;
  status: OrderStatus;
  publicNote: string;
  deliveryNote: string;
  needsReview: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = new FormData(e.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await api(
        `/api/admin/orders/${id}`,
        {
          revision,
          status: form.get("status"),
          publicNote: form.get("publicNote"),
          deliveryNote: form.get("deliveryNote"),
        },
        "PATCH",
      );
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
      <h2>处理与交付</h2>
      {needsReview && <p>请先完成账目复核，再更新处理进度。</p>}
      <fieldset disabled={pending || needsReview} className="plain-fieldset">
        <div className="field">
          <label htmlFor="order-status">订单状态</label>
          <select id="order-status" name="status" defaultValue={status}>
            {[status, ...nextOrderStatuses[status]].map((s) => (
              <option key={s} value={s}>
                {orderStatusLabels[s]}
              </option>
            ))}
          </select>
          <small>推进交付前需登记足额收款；取消前需退清已收金额。</small>
        </div>
        <div className="field">
          <label htmlFor="order-public">用户可见说明</label>
          <textarea
            id="order-public"
            name="publicNote"
            maxLength={2000}
            defaultValue={publicNote}
          />
        </div>
        <div className="field">
          <label htmlFor="order-delivery">交付内容说明</label>
          <textarea
            id="order-delivery"
            name="deliveryNote"
            maxLength={4000}
            defaultValue={deliveryNote}
            placeholder="写明交付成果与使用说明。请勿填写账号密码、验证码。"
          />
          <small>用户可以看到。标记已交付或已完成时必填。</small>
        </div>
        <Button type="submit">{pending ? "正在保存…" : "保存处理进度"}</Button>
      </fieldset>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function MoneyForm({
  id,
  revision,
  cancelled,
}: {
  id: string;
  revision: number;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = new FormData(e.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const data = {
        kind: form.get("kind"),
        amount: form.get("amount"),
        reference: form.get("reference"),
        note: form.get("note"),
        confirmed: form.get("confirmed") === "on",
      };
      const payload = JSON.stringify(data);
      if (attempt.current?.payload !== payload)
        attempt.current = {
          payload,
          key: Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(""),
        };
      await api(`/api/admin/orders/${id}/money`, {
        ...data,
        revision,
        idempotencyKey: attempt.current.key,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登记失败。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="panel" onSubmit={save}>
      <h2>登记实际收款 / 退款</h2>
      <p>先在收款渠道核对交易，再登记。此操作不会向用户扣款或执行退款。</p>
      <fieldset className="plain-fieldset" disabled={pending || cancelled}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="money-kind">登记类型</label>
            <select id="money-kind" name="kind">
              <option value="PAYMENT">收款</option>
              <option value="REFUND">退款</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="money-amount">本次金额（元）</label>
            <input
              id="money-amount"
              name="amount"
              type="number"
              required
              min="0.01"
              max="100000"
              step="0.01"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="money-reference">交易凭据编号（仅管理员可见）</label>
          <input
            id="money-reference"
            name="reference"
            required
            minLength={3}
            maxLength={120}
            autoComplete="off"
          />
          <small>
            使用实际交易单号；同一订单同类凭据只能有一笔有效登记。原登记冲正后可重新录入。
          </small>
        </div>
        <div className="field">
          <label htmlFor="money-note">核对说明（仅管理员可见）</label>
          <textarea
            id="money-note"
            name="note"
            required
            minLength={3}
            maxLength={1000}
          />
        </div>
        <label className="checkbox-field">
          <input name="confirmed" type="checkbox" required />
          <span>我已核对实际到账或退款记录，确认金额和凭据正确。</span>
        </label>
        <Button type="submit">{pending ? "正在登记…" : "确认登记"}</Button>
      </fieldset>
      <p className="muted">登记前请仔细核对，保存后不能直接修改或删除。</p>
      {cancelled && <p>订单已取消，收退款登记已关闭。</p>}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
