# 分流标签

各 Skill 使用五种标准分流角色。本文件将这些角色映射到本仓库本地 Markdown Issue 跟踪器实际使用的标签字符串。

| mattpocock/skills 中的标签 | 本仓库中的标签 | 含义 |
| -------------------------- | ---------------- | ------ |
| `needs-triage`             | `needs-triage`       | 维护者需要评估此 Issue |
| `needs-info`               | `needs-info`         | 等待报告人补充更多信息 |
| `ready-for-agent`          | `ready-for-agent`    | 已完整定义，可由自主 Agent 执行 |
| `ready-for-human`          | `ready-for-human`    | 需要人工实现 |
| `wontfix`                  | `wontfix`            | 不会处理此项 |

当某个 Skill 提及分流角色（例如“应用可由 Agent 完成的分流标签”）时，请使用本表中的对应标签字符串。

对于本地 Markdown Issue，请在 Issue 文件顶部附近将所选角色写入 `Status:` 字段。
