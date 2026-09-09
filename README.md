# AI 小站 / ai-service-web

面向校园用户的 AI 服务网站。Next.js App Router + TypeScript + Tailwind CSS + PostgreSQL + Prisma ORM。

## 当前阶段：套餐、订单与交付管理（v0.3）

用户可浏览已上架套餐并提交咨询。管理员确认成交价和交付约定后，将咨询转为订单，登记已核对的实际收退款并记录交付。用户继续通过原来的“需求编号 + 查询码”查看咨询和关联订单。

| 路径                     | 功能                                                |
| ------------------------ | --------------------------------------------------- |
| `/`                      | 服务展示、使用场景、流程、常见问题                  |
| `/services/chatgpt`      | ChatGPT 订阅协助详情                                |
| `/services/custom-agent` | AI 助手定制详情                                     |
| `/custom`                | 提交需求；也可只生成、复制和下载本地草稿            |
| `/orders`                | 需求与关联订单进度查询；另保留 `DEMO-2026` 演示按钮 |
| `/admin/login`           | 管理员登录                                          |
| `/admin`                 | 需求列表、编号搜索、状态筛选与分页                  |
| `/admin/requests/[id]`   | 查看详情、更新状态、用户可见说明和内部备注          |
| `/help`                  | 服务与信息使用说明                                  |

**已支持成交订单与人工收退款登记，尚未接通在线支付。** 登记不会扣款或执行退款。未接入自动充值、模型 API、用户注册或邮件/微信通知。经营者需通过实际业务渠道与用户确认报价、服务范围及退款约定。

新增页面：

| 路径                 | 功能                                     |
| -------------------- | ---------------------------------------- |
| `/packages`          | 已上架套餐、参考价及咨询入口             |
| `/admin/packages`    | 套餐列表、创建、改价、上架/下架          |
| `/admin/orders`      | 订单编号搜索、状态筛选与分页             |
| `/admin/orders/[id]` | 成交快照、收退款登记、交付说明与历史记录 |

## 从 v0.2 更新

停止正在运行的本地网站后，执行以下命令。保留现有 `.env` 和数据库卷，无需重新初始化管理员密码：

```bat
git switch feat/service-pages
git -c http.version=HTTP/1.1 pull --ff-only
npm ci
docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
npm run db:migrate
npm run dev
```

新迁移只添加套餐、订单、流水及相关约束，保留现有咨询和管理员配置。套餐初始为空，由你在后台创建真实服务内容和价格。

## Windows 本地启动

需要 Node.js 24、Git，以及已运行的 Docker Desktop（或自行准备 PostgreSQL 17）。

在现有仓库目录更新。若你改过本地文件，请先提交或妥善保存，避免拉取发生冲突：

```bat
git switch feat/service-pages
git -c http.version=HTTP/1.1 pull --ff-only
npm ci
npm run setup
docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
npm run db:migrate
npm run dev
```

`npm run setup` 会补齐 `.env` 中缺失的配置，生成随机数据库密码、管理员密码哈希与限流密钥。终端会显示新生成的管理员密码，请保存；已有的非空配置不会被替换。

- 网站：http://localhost:3000
- 管理后台：http://localhost:3000/admin
- 默认管理员用户名：`admin`，密码以本地 setup 输出为准，无共享默认密码。
- `APP_URL` 默认为 `http://localhost:3000`，请使用相同地址打开，避免同源检查失败。
- `npm ci` 自动生成 Prisma Client，不要求数据库正在运行；表单提交和后台功能要求数据库已启动且迁移完成。
- 已有 PostgreSQL 时，在 `.env` 中填入你的 `DATABASE_URL`，跳过 Docker 启动数据库步骤。请使用专门为该网站创建的数据库。
- 只想看页面，可以先 `npm run dev`；未配置数据库时提交会显示服务不可用，不会伪装为成功。

停止本地网站按 Ctrl+C；停止开发数据库：

```bat
docker compose -f compose.yaml -f compose.local.yaml stop db
```

数据保存在 `postgres_data` Docker 卷中，停止容器不删除数据。不要用 `docker compose down -v` 删除需要保留的数据库。

## 本地验收

1. 打开 `/custom`，填写至少 10 个字符的需求、有效邮箱或微信号，并勾选同意提交。
2. 提交后复制或下载需求凭证，保存编号和 48 位查询码。
3. 使用另一个浏览器窗口登录 `/admin`，查看这份需求。
4. 打开详情，填写用户可见说明与内部备注，将状态改为“处理中”并保存。
5. 在 `/orders` 输入编号和查询码，应看到公开状态和说明，看不到联系方式或内部备注。
6. 测试错误查询码、未登录访问后台、退出后访问后台，以及刷新/重启后数据是否保留。

查询码只保存在提交成功页面和你主动保存的凭证中，数据库只保存哈希。查询码丢失后不能从数据库还原；当前版本没有自动找回流程。

## 套餐与订单验收

1. 登录 `/admin/packages` 创建套餐，先保存为未上架，确认 `/packages` 不展示；再上架，检查展示的价格和内容。
2. 提交一份咨询，在后台咨询详情中选套餐、填写确认后的成交价与交付约定，并勾选已与用户核对。
3. 生成订单后，修改或下架套餐，历史订单的名称、成交价和约定应保持不变。
4. 使用专门的测试订单登记收款：填写金额、实际交易凭据及核对说明。请勿在真实订单里虚构交易。
5. 足额登记收款后，按“待处理 → 处理中 → 已交付 → 已完成”推进；已交付、已完成必须有交付说明。
6. 用户用原需求编号与查询码应看到关联订单、成交金额、登记收退款合计和交付说明，不能看到交易凭据或管理员核对备注。
7. 有剩余已收金额时不能取消；先核对实际退款并登记，再取消。已完成订单支持后续退款登记，交付历史仍保留。

规则与当前边界：

- 每份咨询最多关联一张订单。重复转换返回已有订单；更改转换内容不会覆盖已有成交。
- 成交名称、金额、服务和交付约定保存为固定快照，当前版本不支持改单或追加订单。
- 所有金额按整数分保存，单笔/成交范围为 0.01–100000 元；不支持零元订单、外币或线上支付回调。
- 套餐和订单更新校验版本。订单事务使用行锁；同一登记请求重试只记一笔，同一订单的同类交易凭据也不能重复登记。
- 累计收款不能超过成交价，退款不能超过尚未退还的收款。发生退款后不能重新收款；交付状态与退款记录分别保留。
- 收退款流水与交付历史保存后不直接修改或删除。当前尚无登记错误冲正界面，正式使用前请确认这一限制适合你的处理流程。
- 用户查询仍使用原咨询凭证，订单号暂不作为独立查询凭证；不会自动发送新订单通知。
- 列表分页；订单详情展示最近 50 笔流水和 30 次处理记录，完整历史仍保存在数据库。

## 配置说明

| 变量                     | 用途                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `DATABASE_URL`           | Node.js 应用与 Prisma CLI 的 PostgreSQL 连接串                         |
| `DATABASE_POOL_SIZE`     | 数据库连接池大小，1–20，默认 5                                         |
| `POSTGRES_PASSWORD`      | Compose 中 PostgreSQL 用户 `ai_service` 的密码                         |
| `APP_URL`                | 浏览器使用的完整站点源，例如 `http://localhost:3000` 或你的 HTTPS 域名 |
| `ADMIN_USERNAME`         | 单管理员用户名                                                         |
| `ADMIN_PASSWORD_HASH`    | scrypt 密码哈希，由 setup 或 admin:reset 生成                          |
| `RATE_LIMIT_SECRET`      | 对限流标识做 HMAC 的随机密钥，至少 32 个字符                           |
| `TRUST_PROXY`            | 只有受信任反向代理覆盖 `X-Real-IP` 且应用不直接暴露时，才设为 `true`   |
| `NEXT_PUBLIC_ICP_NUMBER` | 页脚真实备案号，修改后重新构建                                         |

管理员密码重置：

```bat
npm run admin:reset
```

保存新密码并重启应用。新的密码哈希会使旧管理会话失效。Compose 部署时需重新创建 web 容器以加载新配置：`docker compose up -d --force-recreate web`。

`.env`、数据库数据、生成的 Prisma Client 与依赖均不提交 Git。正式环境使用你自己的域名和配置；示例里不包含真实业务凭据。

## 数据与权限实现

- 每个管理页面和修改接口均在服务端验证会话。
- 会话使用随机令牌，数据库保存令牌哈希；Cookie 为 HttpOnly、SameSite=Strict，有效期 8 小时。HTTPS 站点设置 Secure。
- 登录、提交和查询使用数据库限流。代理未启用时，请求共享一个限流标识，适合本地测试；正式 Nginx 部署请按下文正确配置代理。
- JSON 接口校验固定 `APP_URL` 的 Origin、内容类型、32 KiB 请求上限和字段长度。
- 需求查询需要随机 192 位查询码和编号；查询码不放进 URL。返回字段使用服务端白名单，不含联系方式、描述原文、内部备注或数据库主键。
- 相同内容与查询凭证的提交重试只生成一条需求；修改内容不得覆盖已有需求。
- 更新带 revision 乐观锁，防止两个管理窗口相互覆盖。状态与处理记录在事务内一起保存。
- 需求描述和备注由 React 转义；接口错误不打印提交内容、Cookie、查询码或数据库连接串。
- 原型阶段仍设置全站 `noindex, nofollow`。正式公开运营前确认站点内容后再调整。

## 数据库迁移与验证

```bat
npm run typecheck
npm run build
npm run db:migrate
```

迁移位于 `prisma/migrations`，`db:migrate` 使用 `prisma migrate deploy` 应用已提交迁移；它不会 reset 数据库。今后新增结构应添加新迁移，不改动已应用的迁移。

GitHub Actions 会在 PR 更新及 main 推送时使用 PostgreSQL 17 执行安装、构建与集成检查，配置位于 `.github/workflows/ci.yml`。

提供 HTTP + 数据库集成检查 `tests/integration.mjs`，覆盖权限、CSRF、限流、重复提交、查询字段隔离、状态更新冲突、会话失效和应用重启。

测试需要独立的 PostgreSQL 测试数据库（名称以 `_test` 结尾）和已完成的 `npm run build`。脚本运行迁移，启动临时生产服务，并在结束后清理自己创建的需求与会话。不要使用生产数据库。

Windows CMD 示例，替换连接串中的测试数据库凭据：

```bat
set "TEST_DATABASE_URL=postgresql://用户名:密码@127.0.0.1:5432/ai_service_test"
npm run test:integration
```

## Ubuntu 部署

提供 `Dockerfile`、`compose.yaml` 和 `deploy/nginx.conf.example`。Compose 包含 PostgreSQL、一次性迁移服务和网站服务，先等待数据库健康，再迁移，再启动网站。

1. 准备 `.env`，设置真实 HTTPS `APP_URL`、管理员信息与数据库密码。可以在本地运行 setup 生成，再通过自己的安全渠道放到服务器，勿提交到 Git。
2. 配置备案号后执行：

```bash
docker compose up -d --build
docker compose logs --tail=100 web migrate
```

3. Nginx 将域名转发到 `127.0.0.1:3000`，配置有效 HTTPS 证书；参照示例覆盖 `X-Real-IP`，然后设置 `TRUST_PROXY=true` 并重建 web 容器。
4. 应用仅绑定服务器回环地址，生产 Compose 不暴露数据库端口；`compose.local.yaml` 只用于电脑开发。

已有 PostgreSQL 数据卷不会因为修改 `.env` 自动修改数据库密码。需要轮换数据库密码时，先在数据库中更改用户密码，再更新配置。

Docker 与 Nginx 配置需在你的 Ubuntu 服务器上实际验证；此开发环境不替你修改服务器、域名或证书。

## 备份与数据清理

在运行 Compose 的目录，可用 Docker 中的 `pg_dump` 备份。将文件保存到服务器之外，并在独立数据库验证恢复。Windows 使用 CMD 执行重定向，避免旧版 PowerShell 对二进制输出进行转码。

```bash
docker compose exec -T db pg_dump -U ai_service -d ai_service -Fc > ai-service-backup.dump
```

清理脚本默认只显示数量。它只针对“已完成 / 已关闭且 90 天未更新、没有关联订单”的需求，实际执行时一并删除关联处理记录及过期会话、限流记录。

```bash
npm run data:cleanup
npm run data:cleanup -- --apply
```

有订单的咨询、成交信息和收退款记录不会被该脚本清理，数据库外键也阻止直接删除关联咨询。请根据业务保留要求安排执行周期并先备份；本版不自动安排定时删除。用户的个别删除申请需管理员核对后处理。

## 后续开发

下一阶段可加入收退款登记冲正、订单变更及客户通知，再根据实际商户条件接入支付。AI 助手在线运行及模型调用计费属于后续单独范围。

保留仓库原有 MIT License。
