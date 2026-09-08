import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI 小站 · 你的校园 AI 搭子", template: "%s · AI 小站" },
  description:
    "了解 ChatGPT 订阅协助与专属 AI 助手定制，探索期末复习、简历优化和学习计划等使用场景。",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main">
          跳转到正文
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
