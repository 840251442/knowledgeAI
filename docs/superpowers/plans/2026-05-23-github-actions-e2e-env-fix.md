# 2026-05-23 GitHub Actions E2E Env 缺失排查与修复实施计划

## 目标
在 `fix/github-actions` 分支上，以最小改动优先方式，排查并修复 GitHub Actions 中 E2E 报错（重点怀疑 env 变量缺失），并按决策从 CI workflow 中移除 E2E 执行链路，确保主 CI 稳定通过且不改动业务功能。

## 范围
- 允许改动：
1. GitHub Actions workflow（仅限移除 E2E 相关步骤与变量）
2. 必要的文档与进度记录（计划/进度文件）
- 明确不改动：
1. 业务服务逻辑
2. 页面与 API 业务行为
3. 数据模型与业务 schema 设计
4. 非 E2E 的 CI 基础校验链路（lint/typecheck/build）

## 实施步骤

### Phase 1：失败快照与改动边界确认
- [x] 收集失败运行关键信息并确认问题集中在 E2E 链路。
- [x] 确认本次处理策略：从主 CI 中移除 E2E 执行链路，而非继续修补 env 注入。
- [x] 固化改动边界：仅处理 workflow 与文档，不进入业务代码。
- 完成判定：
1. 有明确策略决策与改动边界。
2. 可解释为何本次不继续修复 E2E env 注入。

### Phase 2：移除 CI 中 E2E 执行链路
- [x] 删除 E2E 相关 env：`AUTH_SECRET`、`E2E_FAST_REVIEW`。
- [x] 删除 E2E 相关 step：
1. Install Playwright Chromium
2. Run e2e tests
3. Upload Playwright report
4. Upload test results
- [x] 保留并确认非 E2E 校验链路仍完整：`lint`、`typecheck`、`build`。
- 完成判定：
1. workflow 中不再包含 e2e 相关执行与产物上传。
2. 非 E2E 主校验链路不受影响。

### Phase 3：计划与进度同步
- [x] 将“移除 E2E”决策回写到计划文档。
- [ ] 将执行证据同步到 progress 文档。
- [ ] 提交并推送 `fix/github-actions` 分支。
- 完成判定：
1. 计划与实际代码改动一致。
2. 文档可支撑后续评审。

## 风险与应对
- 风险：CI 不再覆盖端到端回归，可能降低变更发现能力。
  - 应对：后续可单独拆分 e2e workflow（手动触发或定时），与主 CI 解耦。
- 风险：团队误以为 E2E 已修复，实际仅是移除执行。
  - 应对：在计划与进度文档明确“本次为移除策略，不是修复策略”。
- 风险：未来 PR 缺少 E2E 护栏。
  - 应对：在后续任务中补充独立 E2E 流水线设计。

## 验收清单
- [x] `.github/workflows/ci.yml` 中已移除所有 E2E 相关代码。
- [x] CI 仍保留 `lint`、`typecheck`、`build`。
- [x] 本次改动未触及业务功能代码。
- [ ] 计划与 progress 文档已同步完成。
- [ ] `fix/github-actions` 已提交并推送。

## 增量同步记录
| 日期 | 变更类型 | 内容 | 证据 | 状态 |
|---|---|---|---|---|
| 2026-05-23 | Plan Init | 新建“GitHub Actions E2E env 缺失排查修复”实施计划，明确 Phase 1-5 与验收命令 | 计划文档首版 | 已完成 |
| 2026-05-23 | Plan Update | 根据决策切换为“从主 CI workflow 移除 E2E 执行链路”，不再以 env 注入修复为主路径 | 本文档修订 | 已完成 |
