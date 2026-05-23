# 2026-05-23 GitHub Actions E2E Env 缺失排查与修复实施计划

## 目标
在 `fix/github-actions` 分支上，以最小改动优先方式，排查并修复 GitHub Actions 中 E2E 报错（重点怀疑 env 变量缺失），确保 CI 稳定通过且不改动业务功能。

## 范围
- 仅允许改动：
1. GitHub Actions workflow（CI/E2E 相关 yaml）
2. E2E 初始化与启动前诊断逻辑（如 `tests/e2e/global.setup.ts`、测试专用脚本）
3. 必要的文档与进度记录（计划/进度文件）
- 明确不改动：
1. 业务服务逻辑
2. 页面与 API 业务行为
3. 数据模型与业务 schema 设计（除 CI 诊断必需的只读检查）

## 实施步骤

### Phase 1：失败快照与最小改动边界确认
- [ ] 收集最近失败运行的关键信息：失败 Job、失败 Step、报错原文、触发事件类型（`push`/`pull_request`/`workflow_dispatch`）。
- [ ] 标注当前 workflow 中 E2E 依赖的必需 env 列表（按“必须/可选”分级）。
- [ ] 输出“最小改动边界”：只在 CI/E2E 配置与初始化层处理，不进入业务代码。
- 完成判定：
1. 已形成一份“问题快照 + 改动边界”记录（可放入 progress 验证证据区）。
2. 能明确回答“缺哪个 env、在哪个触发上下文缺失”。

### Phase 2：env 存在性预检
- [ ] 在 E2E 执行前新增 `env` 存在性预检步骤（fail-fast），逐项校验必需变量是否存在且非空。
- [ ] 预检输出采用脱敏日志（仅显示变量名与是否存在，不打印敏感值）。
- [ ] 预检失败时给出可操作错误信息（缺失变量名、建议设置位置：repo secrets / vars / workflow env）。
- 完成判定：
1. 缺失必需 env 时，CI 在 E2E 前快速失败，日志可直接定位。
2. env 齐全时，预检步骤稳定通过且不影响后续步骤。

### Phase 3：DB 就绪诊断
- [ ] 在 E2E 前新增 DB 就绪诊断（连接参数存在性 + 服务可达性 + 等待重试）。
- [ ] 补充诊断信息：数据库 host/port（脱敏）、重试次数、最终状态、超时说明。
- [ ] 若使用容器/服务，补充健康检查或等待逻辑，避免“服务未就绪导致假失败”。
- 完成判定：
1. DB 未就绪时可在日志中明确看到“连接失败原因/超时点”。
2. DB 就绪后 E2E 可进入实际执行阶段，不再卡在初始化。

### Phase 4：workflow 触发上下文差异处理（fork/secrets）
- [ ] 梳理并实现 `fork PR` 与本仓库分支在 secrets 可见性上的差异分支策略。
- [ ] 对 `fork PR` 场景增加明确保护：
1. 无 secrets 时跳过依赖 secrets 的 E2E 并给出原因。
2. 或执行不依赖 secrets 的降级检查（如最小 smoke）。
- [ ] 在 workflow summary 中写明“本次运行上下文 + 是否启用 secrets + 采取的策略”。
- 完成判定：
1. `fork PR` 不再因 secrets 缺失产生误报红灯。
2. 同仓库分支仍保留完整 E2E 校验能力。

### Phase 5：验证与回归
- [ ] 本地/CI 前置静态检查通过。
- [ ] E2E 在目标上下文完成验证（至少覆盖一次可访问 secrets 的完整路径）。
- [ ] 触发并观察 GitHub Actions rerun，保存运行证据。
- 完成判定：
1. 验证命令全部通过。
2. GitHub Actions rerun 结果为成功，且日志能证明 env/DB 诊断逻辑生效。

## 风险与应对
- 风险：新增预检误判（把可选变量当必需）导致不必要失败。
  - 应对：变量分级（必须/可选）配置化，先以最小集合上线。
- 风险：DB 诊断等待时间过长拖慢流水线。
  - 应对：设置有限重试与超时上限，超时即失败并输出诊断。
- 风险：`fork PR` 跳过策略被误解为“放松质量门禁”。
  - 应对：在 summary 明确标注跳过原因，并保留 smoke/静态检查。
- 风险：workflow 条件判断写错导致某些事件不执行。
  - 应对：用 `push`、`pull_request`、`workflow_dispatch` 三类触发进行一次覆盖验证。

## 验收清单
- [ ] 改动仅限 CI/E2E 配置与初始化逻辑，无业务功能变更。
- [ ] env 存在性预检已上线且日志可定位缺失变量。
- [ ] DB 就绪诊断已上线且可区分“配置缺失/服务未就绪/连接失败”。
- [ ] 已处理 workflow 触发上下文差异（含 `fork/secrets`）。
- [ ] 验证命令有明确执行证据：
1. `npm run lint`
2. `npm run typecheck`
3. `npm run e2e`（或 `npx playwright test`，按仓库实际脚本）
4. `gh run rerun <run-id>`
5. `gh run watch <run-id>`
6. `gh run view <run-id> --log`
- [ ] GitHub Actions 最终不报错（目标：对应 E2E workflow 绿灯）。

## 增量同步记录
| 日期 | 变更类型 | 内容 | 证据 | 状态 |
|---|---|---|---|---|
| 2026-05-23 | Plan Init | 新建“GitHub Actions E2E env 缺失排查修复”实施计划，明确 Phase 1-5、三项必含检查（env 预检/DB 诊断/fork-secrets 差异）与验收命令 | 计划文档首版 | 已完成 |
