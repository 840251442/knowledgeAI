# 设计文档：Admin UI 多任务修复

**日期**: 2026-05-31  
**分支**: bugfix/260531-ui（从 bugfix/260531 拉出）  
**状态**: 设计确认中

---

## 需求概述

用户提出 4 项任务：
- Task A: 侧边栏新增"导入管理"入口；文章列表头部移除"导入任务"按钮；PERSONAL 角色不显示"审核列表"按钮
- Task B: PERSONAL 用户可删除自己的草稿文章（列表页 + 编辑页均需支持）
- Task C: Markdown 编辑器左右布局 1:1 比例 **（已满足：CSS 已是 `1fr 1fr`，无需修改）**
- Task D: 修复 PDF 解析时 `DOMMatrix is not defined` 报错

---

## 方案

### Task A — 侧边栏 + 文章列表头部

**文件**: `src/app/admin/layout.tsx`

改动：在现有侧边栏 nav 中，"文章管理"后面、"退出"前面，为 **ADMIN 和 PERSONAL 两个角色** 添加一个"导入管理"导航项，指向 `/admin/articles/imports`：

```jsx
<NavLink
  href="/admin/articles/imports"
  label="导入管理"
  pill="导入"
  active={pathname.startsWith("/admin/articles/imports")}
/>
```

**文件**: `src/app/admin/articles/page.tsx`

改动：
1. 移除 `<Button href="/admin/articles/imports">导入任务</Button>`
2. "审核列表"按钮用 `user.role === "ADMIN"` 条件包裹

---

### Task B — PERSONAL 可删除草稿文章

**分析**：
- 服务层 `deleteAdminArticle` 已正确鉴权（PERSONAL 只能操作自己的文章）
- DELETE API `src/app/api/admin/articles/[id]/route.ts` 已允许 PERSONAL

**列表页** (`src/app/admin/articles/page.tsx`):
- 新增 `deleteAction` server action（参考现有 `publishAction`/`unpublishAction`）
- 在每行按钮组中，当 `item.status === "DRAFT"` 时显示"删除"按钮

**编辑页** (`src/components/admin/ArticleEditor.tsx`):
- 增加 `role` prop（`"ADMIN" | "PERSONAL"`）
- 删除按钮显示条件：`mode === "edit" && (status === "PUBLISHED" || status === "DRAFT")`
- 不改动 API 调用（已支持）

**编辑页入口** (`src/app/admin/articles/[id]/edit/page.tsx`):
- 向 `<ArticleEditor>` 传入 `role={user.role}`

---

### Task C — 1:1 编辑器布局

**结论：已满足**

`src/app/admin/admin.css` 第 675 行：
```css
.editorSplit {
  display: grid;
  grid-template-columns: 1fr 1fr;  /* 已经是 1:1 */
  gap: 12px;
  padding: 0 16px 16px;
}
```
无需修改，此任务跳过。

---

### Task D — DOMMatrix polyfill

**问题根因**: `pdf-parse` 内部使用 `pdfjs-dist`，后者在文字提取时调用了 Canvas/DOM API（`DOMMatrix`, `Path2D`），在 Node.js/Serverless 环境中不存在。

**文件**: `src/services/article-import-parse.service.ts`

在 `parsePdf()` 函数内部、调用 `fn(buffer)` 之前，注入最小化 polyfill：

```typescript
async function parsePdf(buffer: Buffer): Promise<string> {
  // Polyfill DOM APIs required by pdfjs-dist in Node.js environments
  if (typeof globalThis.DOMMatrix === "undefined") {
    const stub = class {};
    Object.assign(globalThis, { DOMMatrix: stub, Path2D: stub });
  }
  // ... existing code
}
```

---

## 验收标准

1. PERSONAL 用户侧边栏可见"导入管理"；文章列表头部不再显示"导入任务"按钮；不显示"审核列表"按钮
2. PERSONAL 用户在文章列表和编辑页可看到并点击"删除"草稿文章（ADMIN 也可删除草稿）
3. PDF 上传解析不再抛出 `DOMMatrix is not defined`
4. 构建无报错，CI lint 通过
