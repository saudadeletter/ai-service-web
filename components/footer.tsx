import Link from "next/link";
import { Cat } from "lucide-react";

export function Footer() {
  const icp = process.env.NEXT_PUBLIC_ICP_NUMBER;
  return (
    <>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <Link href="/" className="footer-brand">
              <Cat size={22} /> AI 小站
            </Link>
            <p>让 AI 帮上忙，给生活留点空。</p>
          </div>
          <div className="footer-links">
            <Link href="/help">服务说明</Link>
            <Link href="/custom">提交需求</Link>
            <Link href="/orders">进度查询</Link>
            <Link href="/admin">管理入口</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} AI 小站 · 独立服务网站，与 OpenAI
            无隶属关系
          </span>
          {icp && (
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
            >
              {icp}
            </a>
          )}
          <span>接受需求咨询 · 暂不接收付款</span>
        </div>
      </footer>
      <div className="mobile-actions">
        <Link href="/#services">查看服务</Link>
        <Link href="/custom">咨询定制</Link>
      </div>
    </>
  );
}
