# AI 小站 / ai-service-web

面向校园用户的 AI 服务网站首版页面。采用 Next.js App Router、TypeScript、Tailwind CSS，以及采用 shadcn/ui 结构的可编辑 Button 组件（Radix Slot + CVA）。

## 当前版本

这是可交互的前端原型，**尚不能作为正式交易系统上线接单**。

| 路径                     | 功能                                     |
| ------------------------ | ---------------------------------------- |
| `/`                      | 服务展示、使用场景、服务流程、常见问题   |
| `/services/chatgpt`      | ChatGPT 订阅协助详情                     |
| `/services/custom-agent` | AI 助手定制详情                          |
| `/custom`                | 需求表单校验、生成文本、复制与下载需求单 |
| `/orders`                | 查询虚构演示订单 `DEMO-2026`             |
| `/help`                  | 服务说明、当前版本与数据处理说明         |

- 需求单只在当前页面内存中生成，不上传、不自动保存，刷新即丢失。复制与下载由用户主动触发。
- 未接入真实支付、订单数据库、登录认证或商家后台。
- 套餐价格、办理时效、联系方式未确定，未编造实际报价、客户评价或交付承诺。
- 不收集账号密码、验证码或会话令牌。
- 使用系统字体和随应用打包的图标，无 Google Fonts、外部图片或第三方统计依赖。
- 原型全站设置 `noindex, nofollow`；正式上线前完成业务配置后再调整。

## 本地启动

推荐 Node.js 24 与 npm。版本提示在 `.nvmrc`；依赖版本由 `package-lock.json` 锁定。Windows 可以使用 PowerShell、Git Bash 或 GitHub Desktop。

首次获取代码（开发分支推送后）：

```bash
git clone https://github.com/saudadeletter/ai-service-web.git
cd ai-service-web
git switch feat/service-pages
npm ci
npm run dev
```

浏览器访问 http://localhost:3000 。首版本地测试**不需要数据库、不需要 API Key，也不需要配置支付**。

已有仓库时，先保存你自己的修改，再更新开发分支：

```bash
git fetch origin
git switch feat/service-pages
git pull --ff-only origin feat/service-pages
npm ci
npm run dev
```

停止服务：在终端按 Ctrl+C。

## 检查与生产构建

```bash
npm run typecheck
npm run build
npm start
```

`typecheck` 检查 TypeScript；`build` 使用 Next.js 的 webpack 构建，并检查页面生成。默认构建输出 `standalone`，供 Docker 使用。

建议你在本地实际检查：

1. 桌面和手机宽度下导航、服务卡片、按钮可读且无横向溢出。
2. 手机菜单打开后可进入对应页面；键盘 Tab 可以访问交互项。
3. 点击“期末复习”等场景，需求表单正确预填对应内容。
4. 表单空内容、少于 10 字或未勾选提示时不能生成需求单。
5. 有效填写后能复制、下载文本，修改后再次生成会更新内容。
6. 订单查询输入 `DEMO-2026` 显示示例，其他编号显示演示限制提示。
7. 服务详情、帮助与不存在页面正常显示。

## 内容调整

- 服务项目、使用场景、FAQ：`lib/content.ts`
- 首页：`app/page.tsx`
- 品牌与导航：`components/header.tsx`
- 全站颜色和响应式样式：`app/globals.css`
- 页脚与备案号：`components/footer.tsx`
- 需求单：`components/request-form.tsx`

“AI 小站”是首版暂定站名，可以统一修改。品牌图标使用 Lucide 的 Cat；没有使用第三方角色图片。

## Ubuntu / Docker 部署准备

提供 `Dockerfile` 与 `compose.yaml`。当前版本不包含 PostgreSQL，因为尚无需要持久化的业务；后续接入订单时再添加数据库和迁移。

如需显示真实备案号，在项目根目录创建 `.env`，参考 `.env.example` 填写。它是公开展示信息，构建时写入页面；修改后需要重新构建。不要提交 `.env` 或任何密钥到仓库。

```bash
docker compose up -d --build
docker compose logs --tail=100 web
```

应用只绑定服务器回环地址 `127.0.0.1:3000`，需要现有 Nginx 将域名请求转发到此端口，并配置实际域名的 HTTPS 证书。Docker 配置已提供，但需要在你的服务器上实际验证。

这里不自动修改服务器、防火墙、域名解析、证书或现有 Nginx 配置。

## 下一阶段

1. 确定站名、套餐、真实价格、联系方式、交付与退款条款。
2. 接入 PostgreSQL + Prisma ORM 保存需求及订单，加入服务端校验、限流和数据保留规则。
3. 完成管理员身份验证、权限检查、交付记录，以及用户经身份验证后的订单查询。
4. 接入实际可用的商户支付接口：服务端定价、通知验签、幂等处理、退款与对账。
5. 配置 HTTPS、异机备份、错误监控与日志脱敏，通过验收后开放真实交易。

保留仓库原有 MIT License。
