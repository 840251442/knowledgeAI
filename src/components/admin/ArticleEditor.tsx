"use client";

import { useMemo, useState } from "react";

type CategoryOption = { id: string; name: string; slug: string };
type TagOption = { id: string; name: string; slug: string };

type EditorMode = "create" | "edit";

type EditorInitial = {
  id?: string;
  title: string;
  slug: string;
  summary: string | null;
  contentMarkdown: string;
  categoryId: string;
  tagIds: string[];
  status?: string;
};

type EditorState =
  | { type: "idle" }
  | { type: "saving" }
  | { type: "publishing" }
  | { type: "unpublishing" }
  | { type: "deleting" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

type AiDraftState = "idle" | "generating" | "done" | "error";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ArticleEditor(props: {
  mode: EditorMode;
  categories: CategoryOption[];
  tags: TagOption[];
  initial: EditorInitial;
}) {
  const [title, setTitle] = useState(props.initial.title);
  const [slug, setSlug] = useState(props.initial.slug);
  const [summary, setSummary] = useState(props.initial.summary ?? "");
  const [contentMarkdown, setContentMarkdown] = useState(props.initial.contentMarkdown);
  const [categoryId, setCategoryId] = useState(props.initial.categoryId);
  const [tagIds, setTagIds] = useState<string[]>(props.initial.tagIds);
  const [status, setStatus] = useState(props.initial.status ?? "DRAFT");
  const [state, setState] = useState<EditorState>({ type: "idle" });
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiKeyword, setAiKeyword] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [aiState, setAiState] = useState<AiDraftState>("idle");
  const [aiError, setAiError] = useState("");

  const canSave = useMemo(() => {
    return title.trim() && slug.trim() && contentMarkdown.trim() && categoryId;
  }, [title, slug, contentMarkdown, categoryId]);

  const selectedTags = useMemo(() => new Set(tagIds), [tagIds]);

  function toggleTag(id: string) {
    setTagIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }

  async function generateWithAi() {
    const keyword = aiKeyword.trim();
    if (aiState === "generating") return;
    if (!keyword) {
      setAiState("error");
      setAiError("请输入关键词");
      return;
    }

    setAiPreview("");
    setAiError("");
    setAiState("generating");

    try {
      const res = await fetch("/api/admin/ai/draft/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      if (!res.ok || !res.body) {
        setAiState("error");
        setAiError("AI 生成失败");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const lines = raw.split("\n");
          const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
          const dataText = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";

          let data: { content?: string; message?: string } = {};
          try {
            data = JSON.parse(dataText) as { content?: string; message?: string };
          } catch {
            data = {};
          }

          if (event === "delta" && data.content) {
            setAiPreview((prev) => prev + data.content);
          } else if (event === "done") {
            setAiState("done");
          } else if (event === "error") {
            setAiState("error");
            setAiError(data.message ?? "AI 生成失败");
          }
        }
      }

      setAiState((prev) => (prev === "generating" ? "done" : prev));
    } catch {
      setAiState("error");
      setAiError("AI 生成失败");
    }
  }

  function insertAiDraft() {
    const draft = aiPreview.trim();
    if (!draft) return;

    setContentMarkdown((prev) => (prev.trim() ? `${prev}\n\n${draft}` : draft));
    setAiState("idle");
    setAiKeyword("");
    setAiPreview("");
    setAiError("");
  }

  function discardAiDraft() {
    setAiState("idle");
    setAiKeyword("");
    setAiPreview("");
    setAiError("");
  }

  async function saveDraft() {
    if (!canSave) return;
    setState({ type: "saving" });
    try {
      if (props.mode === "create") {
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            slug,
            summary: summary.trim() ? summary : null,
            contentMarkdown,
            categoryId,
            tagIds,
          }),
        });
        const json = (await res.json()) as
          | { success: true; data: { id: string } }
          | { success: false; error: { message: string } };
        if (!res.ok || !json.success) {
          setState({ type: "error", message: json.success ? "保存失败" : json.error.message });
          return;
        }
        window.location.href = `/admin/articles/${json.data.id}/edit`;
        return;
      }

      const id = props.initial.id;
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          summary: summary.trim() ? summary : null,
          contentMarkdown,
          categoryId,
          tagIds,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "保存失败" : json.error.message });
        return;
      }
      setState({ type: "success", message: "已保存" });
      setTimeout(() => setState({ type: "idle" }), 900);
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  async function publish() {
    if (!canSave) return;
    setState({ type: "publishing" });
    try {
      if (props.mode === "create") {
        const createRes = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            slug,
            summary: summary.trim() ? summary : null,
            contentMarkdown,
            categoryId,
            tagIds,
          }),
        });
        const createJson = (await createRes.json()) as
          | { success: true; data: { id: string } }
          | { success: false; error: { message: string } };
        if (!createRes.ok || !createJson.success) {
          setState({ type: "error", message: createJson.success ? "发布失败" : createJson.error.message });
          return;
        }

        const id = createJson.data.id;
        const publishRes = await fetch(`/api/admin/articles/${id}/publish`, { method: "POST" });
        const publishJson = (await publishRes.json()) as
          | { success: true; data: { id: string } }
          | { success: false; error: { message: string } };
        if (!publishRes.ok || !publishJson.success) {
          setState({ type: "error", message: publishJson.success ? "发布失败" : publishJson.error.message });
          return;
        }

        window.location.href = `/admin/articles/${id}/edit`;
        return;
      }

      const id = props.initial.id;
      if (!id) return;
      const res = await fetch(`/api/admin/articles/${id}/publish`, { method: "POST" });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "发布失败" : json.error.message });
        return;
      }
      setStatus("PUBLISHED");
      setState({ type: "success", message: "已发布" });
      setTimeout(() => setState({ type: "idle" }), 900);
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  async function unpublish() {
    const id = props.initial.id;
    if (!id) return;
    setState({ type: "unpublishing" });
    try {
      const res = await fetch(`/api/admin/articles/${id}/unpublish`, { method: "POST" });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "下线失败" : json.error.message });
        return;
      }
      setStatus("DRAFT");
      setState({ type: "success", message: "已下线" });
      setTimeout(() => setState({ type: "idle" }), 900);
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  async function remove() {
    const id = props.initial.id;
    if (!id) return;
    const ok = window.confirm("确认删除这篇文章？此操作不可恢复。");
    if (!ok) return;
    setState({ type: "deleting" });
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "删除失败" : json.error.message });
        return;
      }
      window.location.href = "/admin/articles";
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  const statusDotClass =
    status === "PUBLISHED" ? "dotGreen" : status === "DRAFT" ? "dotWarn" : "dotCyan";

  return (
    <div className="panel" data-testid="article-editor">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>{props.mode === "create" ? "新建文章" : "编辑文章"}</strong>
          <span>发布后触发切片与向量索引（后续接入）</span>
        </div>
        <div className="actions">
          <span className="badge">
            <span className={cx("dot", statusDotClass)} />
            状态：{status}
          </span>
          <button
            data-testid="article-editor-ai-entry"
            className={cx("btn")}
            type="button"
            onClick={() => setShowAiPanel((prev) => !prev)}
            disabled={state.type !== "idle" && state.type !== "success"}
          >
            AI 创作
          </button>
          <button
            data-testid="article-editor-save"
            className={cx("btn", "btnGhost")}
            type="button"
            onClick={() => void saveDraft()}
            disabled={!canSave || state.type !== "idle"}
          >
            保存草稿
          </button>
          <button
            data-testid="article-editor-publish"
            className={cx("btn", "btnPrimary")}
            type="button"
            onClick={() => void publish()}
            disabled={!canSave || (state.type !== "idle" && state.type !== "success")}
          >
            {state.type === "publishing" ? "发布中…" : "发布"}
          </button>
          {props.mode === "edit" ? (
            <>
              <button
                data-testid="article-editor-unpublish"
                className={cx("btn")}
                type="button"
                onClick={() => void unpublish()}
                disabled={state.type !== "idle"}
              >
                {state.type === "unpublishing" ? "下线中…" : "下线"}
              </button>
              <button className={cx("btn")} type="button" onClick={() => void remove()} disabled={state.type !== "idle"}>
                {state.type === "deleting" ? "删除中…" : "删除"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {state.type === "error" ? <div className="errorBox">{state.message}</div> : null}

      {showAiPanel ? (
        <div className="aiPanel" data-testid="article-editor-ai-panel">
          <div className="label">AI 关键词创作</div>
          <div className="subMuted">输入关键词后生成正文草稿。仅在点击“插入正文”后写入编辑区。</div>
          <input
            data-testid="article-editor-ai-keyword"
            className="input"
            value={aiKeyword}
            onChange={(e) => setAiKeyword(e.target.value)}
            placeholder="例如：Redis 缓存一致性"
          />
          <div className="aiActions">
            <button
              data-testid="article-editor-ai-generate"
              className={cx("btn", "btnPrimary")}
              type="button"
              disabled={aiState === "generating"}
              onClick={() => void generateWithAi()}
            >
              {aiState === "generating" ? "生成中…" : "开始生成"}
            </button>
            <button
              data-testid="article-editor-ai-insert"
              className={cx("btn")}
              type="button"
              onClick={insertAiDraft}
              disabled={!aiPreview.trim()}
            >
              插入正文
            </button>
            <button data-testid="article-editor-ai-discard" className={cx("btn")} type="button" onClick={discardAiDraft}>
              放弃
            </button>
          </div>
          {aiError ? <div className="errorBox" style={{ margin: 0 }}>{aiError}</div> : null}
          <pre data-testid="article-editor-ai-preview" className="aiPreview">
            {aiPreview || "（草稿将在这里流式显示）"}
          </pre>
        </div>
      ) : null}

      <div className="fieldRow">
        <div className="field">
          <div className="label">标题</div>
          <input
            data-testid="article-editor-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="label">Slug</div>
          <input
            data-testid="article-editor-slug"
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </div>

      <div className="fieldRow" style={{ paddingTop: 0 }}>
        <div className="field">
          <div className="label">摘要</div>
          <input
            data-testid="article-editor-summary"
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="label">分类</div>
          <select
            data-testid="article-editor-category"
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="" disabled>
              请选择分类
            </option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ padding: "0 16px 16px 16px" }}>
        <div className="label" style={{ marginBottom: 10 }}>
          标签
        </div>
        <div className="tags">
          {props.tags.map((t) => (
            <span
              key={t.id}
              className={cx("tag", selectedTags.has(t.id) && "tagSelected")}
              onClick={() => toggleTag(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggleTag(t.id);
              }}
            >
              #{t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="editorSplit">
        <div className="pane">
          <h4>Markdown 编辑</h4>
          <textarea
            data-testid="article-editor-markdown"
            className="textarea"
            value={contentMarkdown}
            onChange={(e) => setContentMarkdown(e.target.value)}
          />
        </div>
        <div className="pane">
          <h4>预览</h4>
          <div
            style={{
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.05)",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <strong style={{ fontSize: 14, display: "block" }}>{title || "（未命名）"}</strong>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              {summary || "（无摘要）"}
            </div>
            <div style={{ marginTop: 12, color: "rgba(255,255,255,.64)", fontSize: 12 }}>
              {slug ? `/${slug}` : "（未设置 slug）"}
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(0,0,0,.18)",
              borderRadius: 16,
              padding: 12,
              color: "rgba(255,255,255,.86)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
              minHeight: 160,
            }}
          >
            {contentMarkdown || "（空内容）"}
          </div>
        </div>
      </div>

      <div className="statusLine">
        <span className="badge">
          <span className={cx("dot", "dotBrand")} />
          索引：PENDING
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={cx("btn", "btnGreen")} type="button" disabled>
            重建索引
          </button>
        </div>
      </div>
    </div>
  );
}
