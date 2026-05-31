# Admin UI 多任务修复实施计划

> 设计文档: `docs/designs/2026-05-31-admin-ui-tasks.md`  
> 分支: `bugfix/260531-ui`（从 `bugfix/260531` 拉出，已存在）  
> 执行方式: `superpowers-executing-plans`

**Goal:** 修复后台管理 4 项问题：侧边栏导入管理入口、草稿删除权限、编辑器 1:1 布局、PDF DOMMatrix 崩溃

---

## Task A — 侧边栏 + 文章列表头部改造

**涉及文件:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/articles/page.tsx`

**验收:**
- ADMIN 和 PERSONAL 均可在侧边栏看到"导入管理"
- 访问 `/admin/articles/imports` 时，"导入管理"高亮，"文章管理"不高亮
- 访问 `/admin/articles` 时，PERSONAL 不显示"审核列表"按钮

- [x] **Step 1: layout.tsx — 在"文章管理"后面插入"导入管理" NavLink**

  ```jsx
  <NavLink
    href="/admin/articles/imports"
    label="导入管理"
    pill="导入"
    active={pathname.startsWith("/admin/articles/imports")}
  />
  ```
  同时修正"文章管理"的 active 条件，排除 imports 路径：
  ```jsx
  active={pathname.startsWith("/admin/articles") && !pathname.startsWith("/admin/articles/imports")}
  ```
  **"导入管理"对 ADMIN 和 PERSONAL 均不包裹 `isAdmin` 条件。**

- [x] **Step 2: articles/page.tsx — 移除"导入任务"按钮，"审核列表"改为 ADMIN-only**

  ```jsx
  // 删除：
  <Button href="/admin/articles/imports" data-testid="admin-import-entry">导入任务</Button>

  // 修改为：
  {user.role === "ADMIN" ? (
    <Button className="btn" href="/admin/reviews">审核列表</Button>
  ) : null}
  ```

- [x] **Step 3: 验证** — `npx tsc --noEmit` + `npx eslint src/app/admin/layout.tsx src/app/admin/articles/page.tsx`

---

## Task B — PERSONAL 用户可删除草稿文章

**涉及文件:**
- Modify: `src/app/admin/articles/page.tsx`
- Modify: `src/components/admin/ArticleEditor.tsx`
- *(服务层 `deleteAdminArticle` 与 DELETE API 已支持 PERSONAL，无需改动)*

**验收:**
- 文章列表中，DRAFT 状态文章显示"删除"按钮，点击后文章消失
- 编辑页中，DRAFT 状态文章显示"删除"按钮
- PUBLISHED 文章编辑页仍显示"下线"和"删除"按钮

- [x] **Step 1: articles/page.tsx — 新增 deleteAction server action**

  参考现有 `publishAction`/`unpublishAction` 格式，调用 `deleteAdminArticle`：
  ```typescript
  async function deleteAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;
    const actor = await requireRole(["ADMIN", "PERSONAL"]);
    if (!actor) redirect("/admin/login");
    await deleteAdminArticle(id, { id: actor.id, role: actor.role });
    revalidatePath("/admin/articles");
  }
  ```
  同时在 import 行添加 `deleteAdminArticle`。

- [x] **Step 2: articles/page.tsx — 在列表行草稿文章添加删除按钮**

  在 unpublishAction form 之后，当 `item.status === "DRAFT"` 时显示：
  ```jsx
  {item.status === "DRAFT" ? (
    <form action={deleteAction}>
      <input type="hidden" name="id" value={item.id} />
      <Button className="btn" htmlType="submit">删除</Button>
    </form>
  ) : null}
  ```

- [x] **Step 3: ArticleEditor.tsx — 扩展删除按钮显示条件**

  当前条件：`props.mode === "edit" && status === "PUBLISHED"` 才显示下线+删除。
  修改为：
  - 下线按钮：仅 `status === "PUBLISHED"`
  - 删除按钮：`status === "PUBLISHED" || status === "DRAFT"`

  ```jsx
  {props.mode === "edit" && status === "PUBLISHED" ? (
    <Button data-testid="article-editor-unpublish" ...>下线</Button>
  ) : null}
  {props.mode === "edit" && (status === "PUBLISHED" || status === "DRAFT") ? (
    <Button onClick={() => void remove()} ...>
      {state.type === "deleting" ? "删除中…" : "删除"}
    </Button>
  ) : null}
  ```

- [x] **Step 4: 验证** — `npx tsc --noEmit` + `npx eslint src/app/admin/articles/page.tsx src/components/admin/ArticleEditor.tsx`

---

## Task C — 修复编辑器左右两栏实际不是 1:1

> **注**: 设计文档原写"已满足"，但实测不是 1:1。
> 根因：`.pane` 没有 `min-width: 0`，CSS Grid 子项默认 `min-width: auto`，
> MDEditor 内部最小宽度撑开左列超过 50%。

**涉及文件:**
- Modify: `src/app/admin/admin.css`

**验收:**
- 编辑器左（Markdown 编辑）和右（预览）视觉等宽

- [x] **Step 1: admin.css — 给 `.pane` 补加 `min-width: 0; overflow: hidden;`**

  ```css
  .pane {
    padding: 12px;
    min-height: 320px;
    margin: 0;
    min-width: 0;       /* 防止 Grid 子项被 MDEditor 内部宽度撑开 */
    overflow: hidden;
  }
  ```

- [x] **Step 2: 验证** — 浏览器打开编辑页，确认左右等宽

---

## Task D — 修复 PDF 解析 `DOMMatrix is not defined`

**涉及文件:**
- Modify: `src/services/article-import-parse.service.ts`

**验收:**
- 上传 PDF 文件后不抛出 `DOMMatrix is not defined`，能正常解析文字

- [x] **Step 1: 在 `parsePdf()` 内调用 pdf-parse 之前注入 polyfill**

  ```typescript
  async function parsePdf(buffer: Buffer): Promise<string> {
    // Polyfill DOM APIs required by pdfjs-dist in Node.js/serverless environments.
    // pdfjs-dist references DOMMatrix and Path2D even during text-only extraction.
    if (typeof globalThis.DOMMatrix === "undefined") {
      const stub = class {};
      Object.assign(globalThis, { DOMMatrix: stub, Path2D: stub });
    }
    type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>;
    const mod = (await import("pdf-parse")) as unknown as { default: PdfParseFn } | PdfParseFn;
    const fn: PdfParseFn =
      typeof mod === "function" ? mod : (mod as { default: PdfParseFn }).default;
    const data = await fn(buffer);
    return normalizeText(data.text);
  }
  ```

- [x] **Step 2: 验证** — `npx tsc --noEmit` 确认无新增类型错误

---

## 提交策略

每个 Task 完成验证后独立提交，消息格式：
- `fix(admin): Task A - 侧边栏导入管理入口 + 文章列表头部清理`
- `fix(admin): Task B - PERSONAL 用户可删除草稿文章`
- `fix(admin): Task C - 修复编辑器左右两栏 1:1 (min-width: 0)`
- `fix(admin): Task D - PDF 解析 DOMMatrix polyfill`

每次提交必须同步追加 `docs/records/non-upgrade-changelog.md`。

---

## 执行顺序

Task A → Task B → Task C → Task D（顺序执行，无强依赖，但 A/B 共享 `articles/page.tsx`，先做 A 再做 B 可合并同文件修改）
