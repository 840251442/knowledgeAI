# 2026-05-23 Workflow Ordering Enforcement Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 强化本仓库多 Agent 工作流，确保阶段 1-7 只能按顺序执行，不能跳步、并行或重排。

**Architecture:** 通过同步修改编排 Agent 与入口 Prompt 的阶段门禁，统一约束输入校验、需求、计划、进度、执行、验收与收口七个阶段。另补充对应的进度记录，确保后续修改时能持续追踪验证状态。

**Tech Stack:** Markdown、VS Code Copilot Agent 配置、仓库既有 prompt/agent 约束文件。

---

### Task 1: Lock workflow stage order

**Files:**
- Modify: `.github/agents/knowledge-orchestrator.agent.md`
- Modify: `.github/prompts/run-multi-agent-workflow.prompt.md`
- Create: `docs/superpowers/work-progress/2026-05-23-workflow-ordering/progress.md`

- [ ] **Step 1: Add explicit 1-7 stage gate rules**

- [ ] **Step 2: Update workflow entry prompt to match stage order**

- [ ] **Step 3: Record progress and verification evidence**