# Prompts（减少 Token 的大 Prompt）

这些 Prompt 用于在项目开发过程中减少重复解释上下文的 token 消耗。按角色拆分，直接复制对应内容给模型即可。

## 项目级规则

- 只要发生代码改动，就必须同步检查并更新项目根目录的 `README.md`
- 如果本次代码改动不需要更新 `README.md`，必须明确说明原因
- 每次代码改动都必须同步更新当前执行中的计划文档（位于 `docs/superpowers/plans/`）
- 默认所有角色 Prompt 都继承这条规则

## 使用方式

1. 选择你要推进的方向（前端/后端/UI-UX/数据库/向量检索）
2. 复制对应 Prompt 全文
3. 默认继承上面的项目级规则
4. 在 Prompt 末尾追加两行即可开始推进：
   - 当前进度：…
   - 当前任务/报错：…

## Prompt 列表

- [前端 Prompt](./frontend.md)
- [UI/UX 专家 Prompt](./ui-ux-engineer.md)
- [后端 Prompt](./backend.md)
- [数据库 Prompt](./database.md)
- [向量数据库与语义检索 Prompt](./vector-search.md)
