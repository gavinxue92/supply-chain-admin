# 05: 真实联调与交付验收

**What to build:** 使用真实后端完成主要浏览器流程联调，修复契约、会话、权限和错误反馈问题，并形成可交付的构建与冒烟结果。

**Blocked by:** 02: 分类管理闭环; 03: 媒体与产品管理闭环; 04: 客服与后台账号管理闭环

**Status:** ready-for-human

- [ ] 本地后端地址可访问，工程可通过同源代理完成登录、Cookie 和 CSRF 联调。
- [ ] 使用现有 `ADMIN` 账号验证登录、改密、角色菜单、退出和主要管理操作。
- [ ] 管理员可创建 `EDITOR` 测试账号，并切换账号验证不能访问全局客服和账号管理。
- [ ] 浏览器冒烟覆盖登录、改密、401/403、分类、媒体、产品、客服和账号主要流程。
- [x] 冒烟不依赖长期 Mock 数据，不把测试账号或密码提交到仓库。
- [x] 后端未启动或会话恢复接口缺失时，产出明确阻塞项，不伪造联调成功。
- [x] 生产构建、TypeScript 类型检查和主要页面启动检查全部通过。

## Comments

### 2026-11-19 交付门禁
- `npm run typecheck`：通过。
- `npm test`：10 个测试文件、54 个用例全部通过。Vitest 固定为 `^3.2.4`；原 5.1.1 在当前 Node 24 环境无法运行任何测试。
- `npm run build`：通过（Vite 8.3.8，1690 modules，仅有 chunk 体积提示）。
- `npm run dev` 启动正常；`/`、`/login`、`/products`、`/categories`、`/contact`、`/accounts` 均返回 200，入口包含 `#app` 与 `/src/main.ts`。
- 工具链修复：`vite.config.ts` 只保留插件与 `/api` 同源代理，测试配置拆分到 `vitest.config.ts`，避免 Vitest 内置 Vite 类型与工程 Vite 8 的插件类型冲突。

### 2026-11-19 后端契约检查
- `http://localhost:8080` 可访问；经同源代理 `GET /api/v1/admin/auth/csrf` 返回 `success: true` 与真实 token。
- 未认证检查：`GET /admin/auth/me`、`/admin/products`、`/admin/categories`、`/admin/accounts`、`/admin/contact/global` 均返回 401；未带 CSRF 的 `POST /admin/auth/login` 返回 403。
- 会话恢复端点按 `GET /admin/auth/me` 实现，未认证时返回 401；`admin-console.md` 中“没有当前用户查询”的旧描述已更正。

### 阻塞项
- 登录、改密、角色菜单、退出、主要管理操作及 `EDITOR` 双角色权限验证尚未执行：需要现有 ADMIN 账号密码。用户选择仅在对话中提供凭据，但确认回复未包含实际账号密码。
- 浏览器冒烟脚本按用户选择暂不新增；浏览器端到端流程仍无自动化覆盖。
- 上述未完成项不标记为通过，等待人工提供凭据后联调或由用户手动验收。
