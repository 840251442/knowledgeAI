# knowledgeAI

AI 在线知识库（公开站 + 管理后台 + 混合搜索）。

## Workspace Skills

- 本地已安装 `superpowers:executing-plans`
- 本地已按上游 `obra/superpowers` 模板安装 `superpowers:subagent-driven-development`
- 技能目录位于 `.trae/skills/superpowers-subagent-driven-development/`
- 配套文件包含 `SKILL.md`、`implementer-prompt.md`、`spec-reviewer-prompt.md`、`code-quality-reviewer-prompt.md`

## E2E 测试运行说明

### 前置条件

- Node: `22`，仓库根目录已有 `.nvmrc`
- 包管理器: `npm`
- 数据库: MySQL 8.0+ 或仓库自带的本地 MySQL helper
- 缓存: Redis 可选，未配置时自动降级为直接读取数据库
- 必需环境变量:
  - `DATABASE_URL`
  - `AUTH_SECRET`
- 可选环境变量:
  - `REDIS_URL`
  - `QDRANT_URL`
  - `QDRANT_API_KEY`
  - `QDRANT_COLLECTION`
  - `EMBEDDING_PROVIDER`
  - `EMBEDDING_API_KEY`
  - `EMBEDDING_BASE_URL`
  - `EMBEDDING_MODEL`
  - `AI_WRITER_MODEL`
  - `AI_WRITER_MAX_CHARS`

推荐先切到项目要求的 Node 版本：

```bash
source ~/.nvm/nvm.sh
nvm use
```

### 首次准备

安装依赖：

```bash
npm install
```

首次安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

如果要手动回填文章切片与 embedding 占位数据：

```bash
npm run embeddings:backfill
```

如果要手动重建全部文章索引：

```bash
npm run reindex:all
```

如果本地也想启用 Redis 缓存，额外配置：

```bash
export REDIS_URL="redis://127.0.0.1:6379"
```

### 本地运行

#### 方式 A：使用项目自带本地 MySQL

启动本地 MySQL：

```bash
bash scripts/dev-mysql-local.sh
```

脚本默认会在 `127.0.0.1:3307` 启动数据库，并输出对应的 `DATABASE_URL`。

推荐的本地测试命令：

```bash
source ~/.nvm/nvm.sh
nvm use

export DATABASE_URL="mysql://knowledgeai:knowledgeai_dev@127.0.0.1:3307/knowledgeai"
export AUTH_SECRET="knowledgeai-e2e-secret"
# 可选：启用 Redis 缓存
# export REDIS_URL="redis://127.0.0.1:6379"

npm run lint
npm run typecheck
npm run test:e2e -- --project=chromium
```

如果只想跑单个 spec：

```bash
npm run test:e2e -- tests/e2e/smoke.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/admin-auth.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/public-browse.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts --project=chromium
```

如果要回归搜索与发布后的索引/缓存链路，推荐直接跑这组已验证命令：

```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium
```

需要可视化调试时：

```bash
npm run test:e2e:headed -- --project=chromium
```

查看 HTML 报告：

```bash
npm run test:e2e:report
```

停止本地 MySQL：

```bash
bash scripts/stop-mysql-local.sh
```

#### 方式 B：使用你自己的 MySQL

复制环境变量模板并填入你自己的数据库连接：

```bash
cp .env.example .env.local
```

最少需要配置：

```env
DATABASE_URL="mysql://user:password@localhost:3306/knowledgeai"
AUTH_SECRET="replace-with-a-long-random-string"
REDIS_URL="redis://127.0.0.1:6379"
```

如果准备切到真实向量检索，还需要补充：

```env
QDRANT_URL="https://xxxxxx.us-east.aws.cloud.qdrant.io"
QDRANT_API_KEY="replace-with-qdrant-api-key"
QDRANT_COLLECTION="knowledgeai-article-chunks"
EMBEDDING_PROVIDER="qwen"
EMBEDDING_API_KEY="replace-with-embedding-api-key"
EMBEDDING_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
EMBEDDING_MODEL="text-embedding-3-small"
AI_WRITER_MODEL="qwen-plus"
AI_WRITER_MAX_CHARS="2000"
```

### AI 创作（后台）

- 入口：文章编辑器中的“AI 创作”按钮
- 输入：关键词
- 输出：流式 Markdown 正文草稿（临时预览区）
- 操作：仅在点击“插入正文”后写入编辑区；点击“放弃”不改正文
- 必需配置：`EMBEDDING_PROVIDER`、`EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`AI_WRITER_MODEL`、`AI_WRITER_MAX_CHARS`

如果需要绕过后台页面，直接验证 AI 草稿流式接口，可在本地启动开发服务器后执行：

```bash
source ~/.nvm/nvm.sh
nvm use
npm run ai:draft:probe -- --keyword "Redis 缓存一致性"
```

该脚本会自动：

- 调用 `/api/admin/login` 登录测试管理员
- 携带登录 cookie 请求 `/api/admin/ai/draft/stream`
- 实时打印 SSE `delta` 内容
- 在结束后输出 `delta/done/error` 统计与最终输出长度

### 账号与审核（后台 + 个人）

- 管理员登录：`/admin/login`，可查看全部文章并进行人工审核
- 个人登录：支持账号密码或手机号 OTP
- 个人发文：先进入 AI 合规审核；通过后自动发布，拒绝或异常转人工审核
- 密码存储：服务端哈希存储，客户端不做自定义加密绕过 HTTPS
- 限流：登录、注册和 OTP 请求均有基础频控，避免暴力请求

然后执行：

```bash
source ~/.nvm/nvm.sh
nvm use
npm run lint
npm run typecheck
npm run test:e2e -- --project=chromium
```

说明：

- `tests/e2e/global.setup.ts` 会自动读取 `.env` / `.env.local`
- 每次执行 E2E 前，测试会自动执行 `prisma migrate reset`、`db seed`、E2E 固定夹具初始化，以及 `embeddings:backfill`
- 这意味着测试数据库中的现有数据会被清空，不能指向生产库或重要开发库
- `REDIS_URL` 不配置时，首页最近更新、文章详情、搜索结果、热门标签会自动回退为直查数据库
- 当前仓库已补入 `Qdrant/OpenAI` 配置边界，后续接通真实向量检索时将直接复用这些环境变量

### CI 运行

CI 的固定执行顺序建议如下：

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run typecheck
npm run test:e2e -- --project=chromium
```

CI 需要提供以下环境变量：

```env
DATABASE_URL=mysql://knowledgeai:knowledgeai_dev@127.0.0.1:3307/knowledgeai
AUTH_SECRET=knowledgeai-e2e-secret
REDIS_URL=redis://127.0.0.1:6379
```

如果 CI 没有 Redis，也可以省略 `REDIS_URL`，应用会自动降级。

如果 CI 自己启动 MySQL 服务，确保：

- 数据库在执行测试前已可连接
- 目标数据库允许 `prisma migrate reset`
- 不与其他任务共享同一个会被保留的数据集

### GitHub Actions Workflow

仓库已经提供 [e2e.yml](file:///Users/a840251442/面试/github专用/knowledgeAI/.github/workflows/e2e.yml)，下面的内容是当前 workflow 的等价示例：

```yaml
name: e2e

on:
  push:
  pull_request:

jobs:
  playwright:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_DATABASE: knowledgeai
          MYSQL_USER: knowledgeai
          MYSQL_PASSWORD: knowledgeai_dev
          MYSQL_ROOT_PASSWORD: knowledgeai_root
        ports:
          - 3307:3306
        options: >-
          --health-cmd="mysqladmin ping -h 127.0.0.1 -u root -pknowledgeai_root"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=30
    env:
      DATABASE_URL: mysql://knowledgeai:knowledgeai_dev@127.0.0.1:3307/knowledgeai
      AUTH_SECRET: knowledgeai-e2e-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:e2e -- --project=chromium
```

### 当前 E2E 覆盖范围

- `tests/e2e/smoke.spec.ts`: 首页可访问
- `tests/e2e/admin-auth.spec.ts`: 后台登录与鉴权
- `tests/e2e/public-browse.spec.ts`: 公开文章浏览与草稿隔离
- `tests/e2e/admin-publish-cache.spec.ts`: 发布、更新、下线主路径，以及发布后跳转编辑页的稳定回归
- `tests/e2e/search-and-analytics.spec.ts`: 搜索结果、搜索日志、`HYBRID` 自然语言查询命中固定夹具

### 当前缓存实现

- Redis 客户端：`src/lib/redis/client.ts`
- 缓存 key：首页最近更新、文章详情、搜索结果、热门标签
- read-through 缓存：文章详情、搜索结果、首页最近更新、热门标签
- 失效钩子：文章 `update / publish / unpublish / delete` 后失效详情缓存并提升列表/搜索/热门标签版本
- 降级策略：`REDIS_URL` 缺失或 Redis 临时不可用时，自动回退为直接访问 MySQL

### 当前语义检索实现

- 切片逻辑：`src/lib/ai/chunking.ts`，按 Markdown 标题层级和块大小生成 `ArticleChunk`
- embedding 逻辑：`src/services/embedding.service.ts`，生成本地 mock embedding 签名并写入 `embeddingVectorRef`
- `Qdrant` 接入边界：`src/config/ai.ts` 与 `src/lib/ai/qdrant.ts` 已就位，后续真实向量检索会直接复用这层 client / collection 封装
- 向量存储：`src/lib/ai/vector-store.ts`，基于 MySQL 中的 `ArticleChunk` 实现轻量相似度召回
- 重建索引：`src/services/reindex.service.ts`，`update / publish` 时自动执行；也支持 `npm run embeddings:backfill` 与 `npm run reindex:all`
- 搜索融合：`src/services/search.service.ts` 会把关键词结果与语义召回结果按配置权重做 `HYBRID` 排序
- 搜索页组件：`src/components/search/SearchBox.tsx`、`src/components/search/SearchFilters.tsx`、`src/components/search/SearchResultCard.tsx`、`src/components/search/SearchResults.tsx`
- 高亮规则：关键词高亮只在展示层完成，不修改 `/api/search` 响应结构；自然语言 `HYBRID` 命中在没有直接词命中时保留原摘要
- 搜索回归命令：`npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium`
