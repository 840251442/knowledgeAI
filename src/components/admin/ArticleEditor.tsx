"use client";

import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Select, message } from "antd";
import remarkGfm from "remark-gfm";

import { slugifyHeading } from "@/lib/markdown/slug";
import { authFetch } from "./adminApi";

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

type IndexState = "not_started" | "pending" | "running" | "success" | "failed";

type IndexStatusPayload = {
  articleId: string;
  state: IndexState;
  latestTask: {
    id: string;
    taskType: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
    createdAt: string;
  } | null;
  chunkSummary: {
    total: number;
    done: number;
    failed: number;
  };
  lastSuccessAt: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getStatusLabel(status: string) {
  if (status === "PUBLISHED") return "已发布";
  if (status === "DRAFT") return "草稿";
  return status;
}

function getSlugLabel(mode: EditorMode) {
  return mode === "create" ? "地址" : "Slug";
}

function getIndexStateLabel(state: IndexState) {
  if (state === "pending") return "排队中";
  if (state === "running") return "处理中";
  if (state === "success") return "已完成";
  if (state === "failed") return "失败";
  return "未触发";
}

function getIndexStateDotClass(state: IndexState) {
  if (state === "success") return "dotGreen";
  if (state === "failed") return "dotWarn";
  if (state === "running" || state === "pending") return "dotCyan";
  return "dotBrand";
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
  const [indexStatus, setIndexStatus] = useState<IndexStatusPayload | null>(null);
  const [indexLoading, setIndexLoading] = useState(props.mode === "edit");
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexError, setIndexError] = useState("");

  const [messageApi, contextHolder] = message.useMessage();

  const generatedSlug = useMemo(() => slugifyHeading(title) || "article", [title]);
  const effectiveSlug = props.mode === "create" ? generatedSlug : slug;

  const canSave = useMemo(() => {
    return title.trim() && contentMarkdown.trim() && categoryId && (props.mode === "create" || slug.trim());
  }, [title, slug, contentMarkdown, categoryId, props.mode]);

  const selectedTags = useMemo(() => new Set(tagIds), [tagIds]);

  const loadIndexStatus = useCallback(async (showLoading = true) => {
    if (props.mode !== "edit" || !props.initial.id) return null;
    if (showLoading) setIndexLoading(true);

    try {
      const res = await authFetch(`/api/admin/articles/${props.initial.id}/index-status`);
      const json = (await res.json()) as
        | { success: true; data: IndexStatusPayload }
        | { success: false; error: { message: string } };

      if (!res.ok || !json.success) {
        setIndexError(json.success ? "索引状态获取失败" : json.error.message);
        return null;
      }

      setIndexError("");
      setIndexStatus(json.data);
      return json.data;
    } catch {
      setIndexError("索引状态获取失败");
      return null;
    } finally {
      if (showLoading) setIndexLoading(false);
    }
  }, [props.mode, props.initial.id]);

  async function pollIndexStatus(maxRounds = 30, intervalMs = 2000) {
    for (let i = 0; i < maxRounds; i += 1) {
      const data = await loadIndexStatus(i === 0);
      if (!data) return;
      if (data.state === "success" || data.state === "failed" || data.state === "not_started") {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), intervalMs);
      });
    }

    messageApi.info("索引状态仍在处理中，可稍后刷新查看");
  }

  async function triggerReindex() {
    if (props.mode !== "edit" || !props.initial.id) return;
    setIndexBusy(true);
    setIndexError("");

    try {
      const res = await authFetch(`/api/admin/articles/${props.initial.id}/reindex`, { method: "POST" });
      const json = (await res.json()) as
        | { success: true; data: { taskId: string; state: IndexState } }
        | { success: false; error: { message: string } };

      if (!res.ok || !json.success) {
        setIndexError(json.success ? "重建索引失败" : json.error.message);
        return;
      }

      messageApi.success("索引重建已触发");
      await pollIndexStatus();
    } catch {
      setIndexError("重建索引失败");
    } finally {
      setIndexBusy(false);
    }
  }

  useEffect(() => {
    if (props.mode !== "edit" || !props.initial.id) return;

    const timer = window.setTimeout(() => {
      void loadIndexStatus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadIndexStatus, props.mode, props.initial.id]);

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
      const res = await authFetch("/api/admin/ai/draft/stream", {
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
        const res = await authFetch("/api/admin/articles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            slug: effectiveSlug,
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
      const res = await authFetch(`/api/admin/articles/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug: effectiveSlug,
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
      if (status === "PUBLISHED") {
        void pollIndexStatus();
      }
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
        const createRes = await authFetch("/api/admin/articles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            slug: effectiveSlug,
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
        const publishRes = await authFetch(`/api/admin/articles/${id}/publish`, { method: "POST" });
        const publishJson = (await publishRes.json()) as
          | { success: true; data: { id: string } }
          | { success: false; error: { message: string } };
        if (!publishRes.ok || !publishJson.success) {
          setState({ type: "error", message: publishJson.success ? "发布失败" : publishJson.error.message });
          return;
        }

        messageApi.success("发布成功");
        setTimeout(() => {
          window.location.href = `/admin/articles/${id}/edit`;
        }, 500);
        return;
      }

      const id = props.initial.id;
      if (!id) return;
      const res = await authFetch(`/api/admin/articles/${id}/publish`, { method: "POST" });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "发布失败" : json.error.message });
        return;
      }
      setStatus("PUBLISHED");
      messageApi.success("发布成功");
      setState({ type: "success", message: "已发布" });
      void pollIndexStatus();
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
      const res = await authFetch(`/api/admin/articles/${id}/unpublish`, { method: "POST" });
      const json = (await res.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "下线失败" : json.error.message });
        return;
      }
      setStatus("DRAFT");
      setState({ type: "success", message: "已下线" });
      void loadIndexStatus();
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
      const res = await authFetch(`/api/admin/articles/${id}`, { method: "DELETE" });
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

  const statusDotClass = status === "PUBLISHED" ? "dotGreen" : status === "DRAFT" ? "dotWarn" : "dotCyan";
  const indexState: IndexState = props.mode === "create" ? "not_started" : (indexStatus?.state ?? "pending");
  const indexDotClass = getIndexStateDotClass(indexState);

  const showSlugField = props.mode === "edit";

  return (
    <div className="panel" data-testid="article-editor">
      {contextHolder}
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>{props.mode === "create" ? "新建文章" : "编辑文章"}</strong>
          <span>发布后触发切片与向量索引（后续接入）</span>
        </div>
        <div className="actions">
          <span className="badge">
            <span className={cx("dot", statusDotClass)} />
            状态：{getStatusLabel(status)}
          </span>
          <Button
            data-testid="article-editor-ai-entry"
            className={cx("btn")}
            onClick={() => setShowAiPanel((prev) => !prev)}
            disabled={state.type !== "idle" && state.type !== "success"}
          >
            AI 创作
          </Button>
          <Button
            data-testid="article-editor-save"
            className={cx("btn", "btnGhost")}
            onClick={() => void saveDraft()}
            disabled={!canSave || state.type !== "idle"}
          >
            保存草稿
          </Button>
          <Button
            data-testid="article-editor-publish"
            className={cx("btn", "btnPrimary")}
            type="primary"
            onClick={() => void publish()}
            disabled={!canSave || (state.type !== "idle" && state.type !== "success")}
          >
            {state.type === "publishing" ? "发布中…" : "发布"}
          </Button>
          {props.mode === "edit" && status === "PUBLISHED" ? (
            <Button
              data-testid="article-editor-unpublish"
              className={cx("btn")}
              onClick={() => void unpublish()}
              disabled={state.type !== "idle"}
            >
              {state.type === "unpublishing" ? "下线中…" : "下线"}
            </Button>
          ) : null}
          {props.mode === "edit" && (status === "PUBLISHED" || status === "DRAFT") ? (
            <Button className={cx("btn")} onClick={() => void remove()} disabled={state.type !== "idle"}>
              {state.type === "deleting" ? "删除中…" : "删除"}
            </Button>
          ) : null}
        </div>
      </div>

      {state.type === "error" ? <div className="errorBox">{state.message}</div> : null}

      {showAiPanel ? (
        <div className="aiPanel" data-testid="article-editor-ai-panel">
          <div className="label">AI 关键词创作</div>
          <div className="subMuted">输入关键词后生成正文草稿。仅在点击“插入正文”后写入编辑区。</div>
          <Input
            data-testid="article-editor-ai-keyword"
            className="input"
            value={aiKeyword}
            onChange={(e) => setAiKeyword(e.target.value)}
            placeholder="例如：Redis 缓存一致性"
          />
          <div className="aiActions">
            <Button
              data-testid="article-editor-ai-generate"
              className={cx("btn", "btnPrimary")}
              type="primary"
              disabled={aiState === "generating"}
              onClick={() => void generateWithAi()}
            >
              {aiState === "generating" ? "生成中…" : "开始生成"}
            </Button>
            <Button
              data-testid="article-editor-ai-insert"
              className={cx("btn")}
              onClick={insertAiDraft}
              disabled={!aiPreview.trim()}
            >
              插入正文
            </Button>
            <Button data-testid="article-editor-ai-discard" className={cx("btn")} onClick={discardAiDraft}>
              放弃
            </Button>
          </div>
          {aiError ? <div className="errorBox" style={{ margin: 0 }}>{aiError}</div> : null}
          <pre data-testid="article-editor-ai-preview" className="aiPreview">
            {aiPreview || "（草稿将在这里流式显示）"}
          </pre>
        </div>
      ) : null}

      <div className={props.mode === "create" ? "editorMetaGrid editorMetaGridCreate" : "editorMetaGrid editorMetaGridEdit"}>
        <div className="field">
          <div className="label">标题</div>
          <Input
            data-testid="article-editor-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {showSlugField ? (
          <div className="field">
            <div className="label">{getSlugLabel(props.mode)}</div>
            <Input data-testid="article-editor-slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        ) : null}
        <div className="field">
          <div className="label">摘要</div>
          <Input
            data-testid="article-editor-summary"
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="label">分类</div>
          <Select
            data-testid="article-editor-category"
            className="input"
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            options={props.categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="请选择分类"
          >
          </Select>
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
          <MDEditor
            value={contentMarkdown}
            onChange={(value) => setContentMarkdown(value ?? "")}
            preview="edit"
            visibleDragbar={false}
            height={420}
            className="markdownEditor"
            data-color-mode="dark"
            renderTextarea={(props) => <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} data-testid="article-editor-markdown" />}
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
          <div className="markdown markdownPreview">
            {contentMarkdown.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: (props) => {
                    const text = String(props.children ?? "");
                    return <h1>{text}</h1>;
                  },
                  h2: (props) => {
                    const text = String(props.children ?? "");
                    return <h2>{text}</h2>;
                  },
                  h3: (props) => {
                    const text = String(props.children ?? "");
                    return <h3>{text}</h3>;
                  },
                  code: (props) => {
                    const className = typeof props.className === "string" ? props.className : "";
                    const inline = Boolean((props as unknown as { inline?: boolean }).inline);
                    if (inline) return <code>{props.children}</code>;
                    return (
                      <pre className="code">
                        <code className={className}>{props.children}</code>
                      </pre>
                    );
                  },
                }}
              >
                {contentMarkdown}
              </ReactMarkdown>
            ) : (
              <div className="markdownEmpty">（空内容）</div>
            )}
          </div>
        </div>
      </div>

      <div className="statusLine">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="badge">
            <span className={cx("dot", indexDotClass)} />
            索引：{indexLoading ? "加载中" : getIndexStateLabel(indexState)}
          </span>
          {props.mode === "edit" && indexStatus?.chunkSummary ? (
            <span className="subMuted">
              切片 {indexStatus.chunkSummary.done}/{indexStatus.chunkSummary.total}
            </span>
          ) : null}
          {props.mode === "create" ? <span className="subMuted">发布后开始构建索引</span> : null}
          {indexError ? <span className="subMuted">{indexError}</span> : null}
          {props.mode === "edit" && indexStatus?.latestTask?.errorMessage ? (
            <span className="subMuted">失败原因：{indexStatus.latestTask.errorMessage}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            className={cx("btn", "btnGreen")}
            type="primary"
            onClick={() => void triggerReindex()}
            disabled={props.mode !== "edit" || indexBusy || indexLoading || state.type !== "idle"}
          >
            重建索引
          </Button>
        </div>
      </div>
    </div>
  );
}
