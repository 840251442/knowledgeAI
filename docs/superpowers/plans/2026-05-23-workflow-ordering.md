# 2026-05-23 Workflow Ordering Enforcement Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 强化本仓库多 Agent 工作流，确保阶段 1-7 只能按顺序执行，不能跳步、并行或重排；并强制分支安全策略：目标分支从当前分支创建、子 Agent 改动先汇总到目标分支、验收通过后仅推送相关分支到远端（不自动合并到当前分支），且禁止将当前分支作为目标分支。

**Architecture:** 通过同步修改编排 Agent 与入口 Prompt 的阶段门禁和分支策略门禁，统一约束输入校验、需求、计划、进度、执行、验收与收口七个阶段，并补充分支发布顺序规则。另补充对应进度记录，确保后续修改时能持续追踪验证状态。

**Tech Stack:** Markdown、VS Code Copilot Agent 配置、仓库既有 prompt/agent 约束文件。

---

### Task 1: Lock workflow stage order

**Files:**
- Modify: `.github/agents/knowledge-orchestrator.agent.md`
- Modify: `.github/prompts/run-multi-agent-workflow.prompt.md`
- Modify: `docs/superpowers/work-progress/2026-05-23-workflow-ordering/progress.md`

- [x] **Step 1: Add explicit 1-7 stage gate rules**

- [x] **Step 2: Update workflow entry prompt to match stage order**

- [x] **Step 3: Record progress and verification evidence**

### Task 2: Enforce branch safety and publish choreography

**Files:**
- Modify: `.github/agents/knowledge-orchestrator.agent.md`
- Modify: `.github/prompts/run-multi-agent-workflow.prompt.md`
- Modify: `docs/superpowers/work-progress/2026-05-23-workflow-ordering/progress.md`

- [x] **Step 1: Require target branch to be created from current branch**

- [x] **Step 2: Block workflow when target branch equals current branch**

- [x] **Step 3: Require subagent -> target branch sequence and publish to remote after acceptance (no auto-merge to current branch)**
