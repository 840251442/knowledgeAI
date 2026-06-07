# Article List And Review Button Fix Design

**Problem:** 前台公开文章列表只能展示少量已发布文章且不可继续访问全部，后台待审核文章列表缺少审核按钮导致人工审核无法进行。
**Solution:** 前台改为懒加载分页直至全部已发布文章可达，后台修复审核按钮可见性逻辑为“待审核状态且具备审核权限即显示”。
**Out of scope:** 不重构审核状态机、不新增审核业务流程、不改动角色模型与数据库结构。

## Technical Approach

### Frontend Public Article List
- 复用现有公开文章分页接口能力，仅查询已发布状态。
- 首屏加载第一页数据，滚动接近底部自动请求下一页，直到无更多数据。
- 维护前端状态：items、isLoading、hasMore、error。
- 追加结果时按文章唯一标识去重，避免并发或重试导致重复展示。
- 请求失败时保留已加载内容，并提供重试能力。

### Admin Review Button Visibility
- 审核按钮显示条件统一为：
  - 文章处于待审核状态；
  - 当前用户具备审核权限（管理员角色）。
- 优先排查并修复：
  - 前端按钮渲染条件误绑定错误状态字段；
  - 后端列表响应缺失状态/权限判定所需字段。
- 保持点击审核按钮后的既有流程不变（通过/拒绝动作沿用现有实现）。

## Interface / Data Structures

### Public List Contract
- Request:
  - page: number
  - pageSize: number
  - status: PUBLISHED (固定)
- Response:
  - items: ArticleSummary[]
  - hasMore: boolean (或由总数/页码推导)

### Admin List Contract
- 每条记录至少具备：
  - reviewStatus/articleStatus（可判断是否待审核）
  - 当前用户角色或后端已过滤后的权限语义
- 前端仅根据“待审核 + 有权限”渲染审核按钮。

## Edge Cases
- 前台无已发布文章时展示空态，不触发懒加载。
- 前台快速滚动时避免并发重复请求。
- 前台网络异常时不清空已加载数据，可重试。
- 后台非管理员不显示审核按钮。
- 后台已审核完成状态不显示审核按钮。
- 后台待审核列表刷新后按钮状态需稳定，不受无关筛选影响。

## Acceptance Criteria
- [ ] 公开站可通过懒加载浏览全部已发布文章，不再只显示少量固定条目。
- [ ] 公开文章列表在无更多数据时明确提示已加载完成。
- [ ] 后台待审核文章列表对有审核权限的用户显示审核按钮。
- [ ] 非待审核或无审核权限场景不显示审核按钮。
- [ ] 相关回归测试覆盖前台懒加载与后台审核按钮可见性。
