# 前端架构与分层规则

1. **技术栈**：Vue 3（`<script setup lang="ts">`）+ Vite + TypeScript + Element Plus + Pinia + Axios。
2. **分层规则**：
   - `src/types/`：必须为所有后端 Request DTO 和 Response VO 定义严格的 TypeScript `interface`，禁止使用 `any`。
   - `src/api/`：所有 Axios 请求必须按模块独立封装（如 `product.ts`、`auth.ts`、`config.ts`）。
   - `src/utils/request.ts`：统一封装 Axios 实例，自动处理 Token 携带、401 拦截与错误提示。
   - `src/views/`：页面仅负责布局和组合组件，复杂的表单（如多规格 SKU 动态增删、多图上传）必须拆分为独立子组件。

## Agent 技能

### Issue 跟踪器

Issue 和规格以本地 Markdown 形式存放在 `.scratch/<feature-slug>/` 中。参见 `docs/agents/issue-tracker.md`。

### 分流标签

分流角色使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human` 和 `wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

采用单上下文布局，根目录包含 `GLOSSARY.md`，并使用 `docs/adr/` 存放架构决策记录。参见 `docs/agents/domain.md`。