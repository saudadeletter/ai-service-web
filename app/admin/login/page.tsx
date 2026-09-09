import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/server/auth";
import { LoginForm } from "@/components/admin-auth";
export const metadata: Metadata = { title: "管理员登录" };
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <div className="container page-shell">
      <div className="login-shell">
        <div className="page-intro">
          <p className="eyebrow">AI 小站 · 管理入口</p>
          <h1>登录，处理新的需求。</h1>
          <p>仅供站点管理员使用。</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
