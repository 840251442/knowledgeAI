---
name: "run-multi-agent-workflow"
description: "在本仓库中启动从目标到验收的多 Agent 编排流程。"
agent: "knowledge-orchestrator"
argument-hint: "目标、约束、验收标准、目标分支"
model: "GPT-5 (copilot)"
---
使用多 Agent 编排执行本仓库工作流。

输入项：
- 目标：
- 约束：
- 验收标准：
- 目标分支：
- 当前计划文档路径：

编排要求：
1. 本 Prompt 只作为入口，不在此文件重复实现细节流程。
2. 必须将执行控制权交给 knowledge-orchestrator。
3. 由 knowledge-orchestrator 按既定链路调用 Skill 与子 Agent：
	- brainstorming：需求发散与风险识别
	- writing-plans：生成或更新计划文档
	- superpowers-subagent-driven-development：子 Agent 执行
	- acceptance-reviewer：验收与合并建议
4. 若任务复杂，必须创建并持续更新 `docs/superpowers/work-progress/<任务标识>/progress.md`。
5. 若输入缺少关键信息，先补齐再执行。

输出章节：
- 目标与约束确认
- 编排结果摘要
- 计划文档路径
- progress 文档路径
- 验收结论
