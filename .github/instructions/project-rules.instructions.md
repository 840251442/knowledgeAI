---
name: "project-rules"
description: "用于实现或修改仓库代码、计划与交付流程时的统一规则，确保文档同步与验证完整。"
applyTo: "**"
---
# 仓库规则

- 只要有代码改动，就检查是否需要同步更新 README.md。
- 如果 README.md 不需要更新，必须明确说明原因。
- 将当前执行中的计划文档与实现进度保持同步（位于 docs/superpowers/plans）。
- 对复杂任务，必须新增并持续更新进度文档：`docs/superpowers/work-progress/<任务标识>/progress.md`。
- `progress.md` 至少包含：目标、当前阶段、已完成项、进行中、阻塞项、下一步、验证证据。
- 发生行为变更时，必须附带验证证据（命令与结果）。
- 优先采用可评审的增量改动，避免一次性大改写。

## 行为变更记录（强制）

- 每次代码改动完成后，**必须**在 `docs/records/non-upgrade-changelog.md` 末尾追加记录。
- 记录格式：`## YYYY-MM-DD` 日期标题 + 简短描述，包含：改动内容、修复原因（如有 bug）、验证命令与结果、关联 commit hash。
- 追加记录后，**立即**将 `docs/records/non-upgrade-changelog.md` 连同本次改动文件一起 `git add && git commit && git push`。
- 不允许"改完先提交代码，changelog 留到后面补"——changelog 必须与代码同批提交。
- 若跳过此步骤，视为本次改动未完成。
