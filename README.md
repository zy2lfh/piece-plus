# 积日 · Piece Plus

面向手机的 3–15 分钟微学习与主动输出空间。**学习一点 → 用自己的话表达 → 回顾 → 长期积累**。

## 应用特性

- 「今日学习」：日语、认知心理学、经济学、技术与游戏设计、地理与历史、创作等主题的短课。
- 「我的输出」：解释、例子、追问三种模式，支持与课程绑定、搜索、修改。
- 「间隔复习」：在 1 / 3 / 7 / 30 / 90 天间隔安排主动回忆；忘记时翌日重试。
- 「我的知识库」：按主题、关键词浏览自己写下的笔记，而不是只积攒阅读量。
- 「数据安全」：在浏览器本地储存，支持 JSON 导入/导出与旧版“积日输出簿”JSON 迁移。
- 主体无需 npm 或框架；新云端能力采用可选 Supabase Auth + PostgreSQL 和 Cloudflare Workers AI。云服务未配置时仍可离线使用。

## 本地运行

可以使用任何静态文件服务器，例如：

```sh
python3 -m http.server 8000
```

在浏览器中打开 `http://localhost:8000`。主页为 `index.html`。

## 目录

- `index.html` 页面结构
- `styles.css` 响应式样式
- `lessons.js` 微学习内容库
- `app.js` 交互、浏览器存储、复习和导入导出
- `cloud.js` 可选的邮箱登录、云端双向合并、AI 反馈
- `cloud-config.js` 公开连接配置（不包含 service_role 密钥）
- `cloudflare/worker.js` 服务端 AI 网关（验证 Supabase 用户 JWT）
- `supabase/schema.sql` 私有用户笔记表 + RLS 策略

## 内容更新

在 `lessons.js` 中按数据结构添加课程：`id`、`topic`、`level`、`minutes`、`title`、`body`、`example`、`prompt`。课程 ID 一旦发布应保持稳定，便于将笔记与课程关联。

AI 生成内容须先进行去重与事实核验，再通过 GitHub commit/PR 合入；部署从 GitHub 自动触发，避免后台 AI 直接覆盖用户笔记。AI 更新课程不应上传个人笔记或将笔记打包进静态站点。

## 隐私与迁移

**当前是本机版本，并非云端同步。** 用户输入写入浏览器 localStorage，不会自动同步到其他设备，也不会提交 GitHub。清除站点数据可能删除笔记，请定期在“设置与备份”导出 JSON。旧版输出簿的数据可在旧版网页导出，再在此处导入；不同域名下 localStorage 无法直接读取。

## 云端和 AI（开发中）

- `feature/cloud-sync-ai` 为开发分支，**尚未部署到生产站点**。在专用 Supabase 项目建立、配置邮件回调域名、配置免费 Cloudflare Worker、测试登录 / RLS / AI 请求前，不应直接合并主分支。
- 云端必须使用专用 Supabase 项目。先在 Supabase SQL editor 中应用 `supabase/schema.sql`，确保表开启 RLS。随后通过 dashboard 配置 Auth Site URL 和 Redirect URLs 为 `https://piece-plus.vercel.app`。
- 获取新项目的 Project URL 和 **publishable key**（浏览器可公开，但必须有 RLS）；填写 `cloud-config.js`。**绝不可提交 secret key、service_role 或第三方私钥。**
- `cloudflare/worker.js` 部署到 Workers Free 并设置名为 `AI` 的 Workers AI binding；配置 Worker 侧 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY` 环境变量后，在 `cloud-config.js` 写入 `/feedback` 完整地址。
- **必须在 Supabase 后台手工配置**：Authentication → URL Configuration → Site URL = `https://piece-plus.vercel.app`；Redirect URLs 添加 `https://piece-plus.vercel.app`（也可添加完整预览域名用于单独测试）。MCP 当前没有专门的 Auth 设置更新工具。若未设置，magic link 可能错误跳向 localhost。
- **免费 SMTP 限制**：Supabase 内置邮件服务仅向 Supabase 项目所在组织的团队成员邮箱发送认证邮件，不适合直接对外开放。个人测试可使用该组织的成员邮箱；若需要任何邮箱登录，请先配置第三方 SMTP 服务并核对免费额度。
- 使用 Supabase 免费邮箱 magic link 登录，发送邮件可能受到服务商的限额和速率限制；回调域名需先允许。
- 现有笔记仍保存在浏览器，登录时尝试双向合并，同 ID 按 `updatedAt` 合并，删除使用 tombstone 标记。本机旧版 JSON 可以继续导入和备份。
- 换账户同步会被阻止以避免意外串号；若需要更换账户或迁移，先导出并在隔离的浏览器配置文件中进行，切勿随意删除 owner 标记。
- 云端数据不是端到端加密；提交到 AI 的笔记内容会被发送到模型服务端。AI 免费配额不是无限量。
- 建议上线前补充自动化测试、冲突处理、滥用限速、服务端实际请求验证。

待实现：完整跨设备验收、更加稳健的冲突解决、知识关联视图、内容生成审核自动化。

## 手动验收

1. 在手机尺寸下打开首页；切换领域和 3/7/15 分钟时卡片内容更新。
2. 对任意学习卡写下解释并保存；刷新页面，知识库能检索到笔记。
3. 修改笔记、搜索、筛选，验证内容仍存在。
4. 在“复习”查看已到期笔记，点击“忘记了”与“记住了”应更新下次日期。
5. 导出 JSON、删除或更换浏览器后重新导入，数据恢复。
6. 导入旧版输出簿 JSON，记录合并且不会复制同 ID 项目。
7. 观察静态页面所有操作在断网后是否提示正确（注意首次访问仍需要网站文件加载）。
8. 云端上线前：在两台不同设备使用同一邮箱登录，验证新建、编辑、删除、已读进度双向同步；另一个账号无法读写这些数据。
9. 用 JWT 缺失、失效、不同用户、错误 Origin、超长输入验证 AI Worker 返回拒绝；合法请求才会调用模型。
10. 免费额度耗尽/云端断网时，确认所有笔记仍可本机访问和 JSON 导出。

## 版本约定

- 直接生产部署主分支；复杂变更优先通过 Pull Request。
- 每次上线都检查 Vercel READY 与实际网页交互。
- 不在公开仓库提交用户私密笔记、凭据或第三方 API Key。
