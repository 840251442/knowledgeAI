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
	- brainstorming：需求发散与风险识别（必须按 skill Step1-4 执行并保存设计文档）
	- writing-plans：生成或更新计划文档（必须基于已保存设计文档）
	- superpowers-subagent-driven-development：子 Agent 执行
	- acceptance-reviewer：验收与合并建议
4. 若任务复杂，必须创建并持续更新 `docs/superpowers/work-progress/<任务标识>/progress.md`。
5. 若输入缺少关键信息，先补齐再执行。
6. 所有阶段必须严格按 1 -> 7 顺序执行，不能跳步、并行或重排。
7. 分支与隔离开发硬门禁：
	- 目标分支必须基于当前分支创建。
	- 目标分支不得等于当前分支。
	- 输入确认后必须先切换到目标分支，再进入需求/计划阶段。
	- 在任何子 Agent 分发之前，必须先完成隔离开发准备：为本次任务创建独立 worktree 或独立子分支，并记录其路径或分支名。
	- 若任务拆分为多个独立子任务，则每个子任务必须拥有自己的子分支或 worktree，禁止多个子 Agent 共享同一个工作区直接开发。
	- 设计文档、计划文档与进度文档必须写在目标分支上下文。
	- 子 Agent 改动先合并到各自任务分支，再由目标分支做集成；验收通过后仅推送子 Agent 分支与目标分支到远端，不自动合并到当前分支。
8. 需求阶段完成标准：
	- 采用 1-2 问题节奏澄清需求；
	- 至少给出 2-3 个方案方向并确认；
	- 分块确认技术方案；
	- 保存设计文档到 `docs/designs/YYYY-MM-DD-<feature-name>.md`。
9. 每完成一个阶段，都必须先输出该阶段摘要后再进入下一阶段。

输出章节：
- 目标与约束确认
- 编排结果摘要
- 设计文档路径
- 计划文档路径
- progress 文档路径
- 验收结论
