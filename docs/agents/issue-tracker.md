# Issue 跟踪器：本地 Markdown

本仓库的 Issue 和规格文档以 Markdown 文件存放在 `.scratch/` 中。

## 约定

- 每个功能使用一个目录：`.scratch/<feature-slug>/`
- 规格文档为 `.scratch/<feature-slug>/spec.md`
- 每张实现 Issue 使用单独的文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 开始；不要将多个 Issue 合并为一个文件
- 在每个 Issue 文件顶部附近记录分流状态，使用 `Status:` 字段（角色字符串参见 `triage-labels.md`）
- 评论和讨论历史追加到文件底部的 `## Comments` 标题下

## 当 Skill 要求“发布到 Issue 跟踪器”时

在 `.scratch/<feature-slug>/` 下创建新文件，并在需要时创建目录。

## 当 Skill 要求“获取相关工单”时

读取引用路径对应的文件。通常由用户直接传入文件路径或 Issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**地图**是一个文件，每张**子工单**对应一个独立文件。

- **地图**：`.scratch/<effort>/map.md`，包含备注、截至目前的决策和待确认问题正文。
- **子工单**：`.scratch/<effort>/issues/NN-<slug>.md`，编号从 `01` 开始，正文记录问题。使用 `Type:` 字段记录工单类型（`research` / `prototype` / `grilling` / `task`）；使用 `Status:` 字段记录 `claimed` / `resolved`。
- **阻塞关系**：在文件顶部附近记录 `Blocked by: NN, NN`。列出的每个文件状态均为 `resolved` 时，工单才解除阻塞。
- **前沿查询**：扫描 `.scratch/<effort>/issues/`，选择处于开放、未阻塞且未认领状态的文件；按编号从小到大选择第一个。
- **认领**：将字段改为 `Status: claimed`，并在开始其他工作前保存文件。
- **解决**：在 `## Answer` 标题下追加答案，将状态改为 `Status: resolved`，然后在 `map.md` 的 Decisions-so-far 中追加上下文指针（gist 和链接）。
