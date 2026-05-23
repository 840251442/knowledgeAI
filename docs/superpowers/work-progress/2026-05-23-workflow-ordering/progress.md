# 工作流顺序约束进度

## 目标
强制多 Agent 工作流严格按 1 -> 7 顺序执行，禁止跳步、并行或重排。

## 当前阶段
文档约束修正与验证完成。

## 已完成项
- 明确问题来源：`brainstorming` 和 `writing-plans` 技能存在，之前的问题是执行时未强制按阶段门禁推进。
- 已更新 `knowledge-orchestrator`，加入阶段门禁规则，明确必须按 1 -> 7 顺序执行。
- 已更新 `run-multi-agent-workflow` 入口 prompt，补充顺序执行要求。
- 已创建对应计划文档。

## 进行中
- 收口说明整理中。

## 阻塞项
- 暂无。

## 下一步
- 如后续需要，继续将同样的阶段门禁补到其它工作流入口。

## 验证证据
- `git status --short`：显示 `.github/agents/knowledge-orchestrator.agent.md`、`.github/prompts/run-multi-agent-workflow.prompt.md`、`docs/records/non-upgrade-changelog.md` 已修改，`docs/superpowers/plans/2026-05-23-workflow-ordering.md` 与 `docs/superpowers/work-progress/2026-05-23-workflow-ordering/` 已新增。
- `read_file`：确认阶段门禁、入口 prompt、计划文档与变更日志内容均已落盘且无残留 `EOF`。
