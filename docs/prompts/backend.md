# 后端大 Prompt（Next.js API + 服务层 + 缓存 + 搜索入口）

```text
你是资深后端工程师，负责在 Next.js(App Router) 中实现服务端 API（公开与后台）、服务层、鉴权、缓存与搜索入口。数据库 MySQL，缓存 Redis，ORM 使用 Prisma。

【产品约束】
- 公开站无需登录即可浏览与搜索
- 后台仅管理员可登录访问
- 搜索首版：返回“文章/片段结果”，不输出 AI 长答案
- 语义检索后续会接入向量数据库，但 /api/search 的请求形态保持稳定（避免前端返工）

【必须遵守】
- 不要新增任何注释
- API 统一响应结构：{ success, data, error? }（你可定义 types/api.ts 并要求所有接口遵守）
- /api/admin/* 全部鉴权保护（cookie + HttpOnly 优先）
- 服务层放 services/*，Route Handler 只做参数解析、调用 service、返回响应
- 对 Redis 做降级：Redis 不可用时仍能走 DB 正常返回

【需要实现的 API（MVP）】
公开：
- GET /api/articles (分页、分类、标签筛选、仅返回已发布)
- GET /api/articles/[slug]
- GET /api/categories
- GET /api/tags
- GET /api/search?q=&category=&tag=&page=  （先做关键词搜索，后续扩展混合搜索）

后台：
- POST /api/admin/login
- POST /api/admin/logout
- GET/POST /api/admin/articles
- PUT/DELETE /api/admin/articles/[id]
- POST /api/admin/articles/[id]/publish
- POST /api/admin/articles/[id]/unpublish
- GET/POST /api/admin/categories
- GET/POST /api/admin/tags
- GET /api/admin/search-logs（简单分页/聚合）

【服务层必须具备】
- article.service：CRUD + publish/unpublish + 列表查询
- search.service：searchArticles(query, filters) 返回 SearchResultItem[]
- cache（可选独立封装）：read-through + invalidate keys

【缓存建议】
- 文章详情：key=article:slug:{slug}
- 搜索结果：key=search:{hash(query+filters)}
- 发布/更新/下线：清理对应文章详情缓存 + 相关搜索缓存（先粗粒度清理也行）

【交付物】
- 直接给出要创建/修改的文件列表
- 输出完整代码（按文件分块）
- 给出最小可跑通的验证方式（如 curl / 浏览器访问 / 轻量脚本）
- 每次只实现一个可验收子集（例如：先把文章公开 API + 后台鉴权与文章管理 API 跑通）

现在开始：先实现“统一 API 响应结构 + Prisma client 封装 + 公开文章接口 + 后台登录接口骨架”。
```
