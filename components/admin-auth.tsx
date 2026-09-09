"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await api("/api/admin/login", {
        username: data.get("username"),
        password: data.get("password"),
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败。");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="username">管理员用户名</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          maxLength={80}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "正在登录…" : "登录管理后台"}
      </Button>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      await api("/api/admin/logout", {});
      router.replace("/admin/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "退出失败，请重试。");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button size="sm" variant="outline" onClick={logout} disabled={pending}>
        {pending ? "正在退出…" : "退出登录"}
      </Button>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </div>
  );
}
