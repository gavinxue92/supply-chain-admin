# 前端架构与分层规则

## 分层

1. **技术栈**：Vue 3（`<script setup lang="ts">`）+ Vite + TypeScript + Element Plus + Pinia + Axios。不引第二套 UI 库。
2. **分层规则**：
   - `src/types/`：所有后端 Request DTO 与 Response VO 定义严格 `interface`，禁止 `any`。字段名必须与 `backend/docs/openapi.json` 一致。
   - `src/api/`：按模块独立封装（`product.ts`、`auth.ts`、`category.ts`、`contact.ts`、`account.ts`、`media.ts`），一个模块一个后端资源。
   - `src/utils/request.ts`：统一 Axios 实例，处理 Cookie 凭证、`X-XSRF-TOKEN`、401 拦截与错误提示。**不使用 Bearer token**。
   - `src/views/`：页面只负责布局与组合组件；多规格动态增删、多图上传、级联分类这类复杂表单必须拆成子组件。
3. **接口边界**：浏览器只请求相对地址 `/api/v1`，开发与生产都走同源反代；不写后端域名、不直连 8080。图片上传是「申请凭证 → 直传对象存储 → 确认登记」，不经业务 JSON 传文件。
4. **职责边界**：前端做表单校验与反馈；业务规则（状态流转、权限、引用计数、HTML 清洗）一律由后端判定，前端不复刻。

## 改动纪律

- 改任何 `src/api/*.ts` 前，先读后端对应 Controller 与 `D:\project\supply-chain\docs\PRODUCT.md` 的规则；字段以 `D:\project\supply-chain\backend\docs\openapi.json` 为准。
- 后端契约变更后必须同步 `src/types/`；它是抄本，冲突时以快照为最终裁决。
- 一次只改一个模块；不顺手重命名、不顺手格式化整文件。
- 危险操作（停用/硬删除账号、归档/硬删除产品、客服启停、全局客服更新）必须有二次确认。
- 临时密码只在成功弹窗一次性展示，不入日志、不入持久化状态。

## 验收

```bash
npm run build
```

预期：构建通过、无类型错误。涉及权限或凭据的流程，未人工验证不得宣称通过。

## 文档索引

| 文档 | 位置 |
|---|---|
| 架构宪法（本文件） | `AGENTS.md` |
| 接口契约（人读版） | `D:\project\supply-chain-miniapp\docs\api-contract.md` |
| 契约快照（唯一真源） | `D:\project\supply-chain\backend\docs\openapi.json` |
| 产品与权限矩阵 | `D:\project\supply-chain\docs\PRODUCT.md` |
| 决策与约束 | `D:\project\supply-chain\docs\DECISIONS.md` |
| 流程与阶段门 | `D:\project\supply-chain\docs\FLOW.md` |
| Prompt 卡片 | `D:\project\supply-chain\docs\PROMPTS.md` |

历史文档（旧 ADR、已完成的工单、旧版对接说明）已归档到 `D:\project\supply-chain\.archive\admin\`，不要参考。
