"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Select } from "antd";

import type { AdminCommentItem } from "@/types/article";
import { apiRequest } from "./adminApi";

type AdminCommentResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: AdminCommentItem[];
};

type ArticleOption = {
  id: string;
  title: string;
  slug: string;
};

export default function AdminCommentTable(props: {
  initialData: AdminCommentResponse | null;
  initialArticles: ArticleOption[];
  initialError?: string | null;
}) {
  const [data, setData] = useState<AdminCommentResponse | null>(props.initialData);
  const [articles, setArticles] = useState<ArticleOption[]>(props.initialArticles);
  const [articleId, setArticleId] = useState("all");
  const [page, setPage] = useState(props.initialData?.page ?? 1);
  const [pageSize, setPageSize] = useState(props.initialData?.pageSize ?? 20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(props.initialError ?? null);
  const mounted = useRef(false);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  const articleOptions = useMemo(
    () => [
      { value: "all", label: "全部文章" },
      ...articles.map((item) => ({
        value: item.id,
        label: `${item.title} (${item.slug})`,
      })),
    ],
    [articles],
  );

  const load = useCallback(
    async (
      next: { page: number; pageSize: number; articleId?: string },
      options?: { keepBusy?: boolean },
    ) => {
      if (!options?.keepBusy) setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(next.page));
        params.set("pageSize", String(next.pageSize));
        if (next.articleId) params.set("articleId", next.articleId);
        const res = await apiRequest<AdminCommentResponse>(`/api/admin/comments?${params.toString()}`);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        setData(null);
      } finally {
        if (!options?.keepBusy) setBusy(false);
      }
    },
    [],
  );

  const refreshArticles = useCallback(async () => {
    try {
      const res = await apiRequest<{
        items: Array<{ id: string; title: string; slug: string }>;
      }>("/api/admin/articles?page=1&pageSize=100");
      setArticles(res.items.map((item) => ({ id: item.id, title: item.title, slug: item.slug })));
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void refreshArticles();
  }, [refreshArticles]);

  useEffect(() => {
    const filter = articleId === "all" ? undefined : articleId;
    if (!mounted.current) {
      mounted.current = true;
      if (!props.initialData) {
        void load({ page, pageSize, articleId: filter });
      }
      return;
    }

    void load({ page, pageSize, articleId: filter });
  }, [articleId, load, page, pageSize, props.initialData]);

  async function remove(item: AdminCommentItem) {
    const preview = item.body.trim().slice(0, 30);
    const ok = window.confirm(`确认删除评论${preview ? `：${preview}` : ""}？`);
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await apiRequest<{ id: string }>(`/api/admin/comments/${item.id}`, { method: "DELETE" });
      const nextPage = data && data.items.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
        return;
      }
      const filter = articleId === "all" ? undefined : articleId;
      await load({ page: nextPage, pageSize, articleId: filter }, { keepBusy: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" data-testid="admin-comments-panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>评论管理</strong>
          <span>按文章筛选、统一删除</span>
        </div>
        <div className="actions">
          <span className="badge">共 {data?.total ?? 0} 条</span>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="subPanel">
        <div className="subPanelHeader">
          <strong>筛选</strong>
          <span className="subMuted">按文章筛选评论列表</span>
        </div>
        <div className="gridForm">
          <div className="field">
            <div className="label">文章</div>
            <Select
              className="input"
              value={articleId}
              onChange={(value) => {
                setArticleId(String(value));
                setPage(1);
              }}
              options={articleOptions}
              disabled={busy}
              data-testid="admin-comments-article-filter"
            >
            </Select>
          </div>
        </div>
      </div>

      <div className="tableWrap">
        <div className="tableHeader">
          <div>文章</div>
          <div>作者</div>
          <div>内容</div>
          <div>时间</div>
          <div />
        </div>

        {(data?.items ?? []).map((item) => (
          <div key={item.id} className="tableRow" data-testid="admin-comment-row">
            <div className="cell">
              <div className="commentArticle">
                <strong className="commentArticleTitle">{item.article.title}</strong>
                <span className="mono">{item.article.slug}</span>
              </div>
            </div>
            <div className="cell">
              <div>{item.author.displayName}</div>
              <div className="subMuted">{item.author.type === "PERSONAL" ? "账号用户" : "游客"}</div>
            </div>
            <div className="cell">
              <div className="commentBody">{item.body}</div>
            </div>
            <div className="cell">
              <span className="subMuted">{item.createdAt.slice(0, 19).replace("T", " ")}</span>
            </div>
            <div className="cell cellActions">
              <Button
                className="btn"
                onClick={() => void remove(item)}
                disabled={busy}
                data-testid="admin-comment-delete"
              >
                删除
              </Button>
            </div>
          </div>
        ))}

        {!busy && data && data.items.length === 0 ? <div className="emptyLine">暂无评论</div> : null}
      </div>

      <div className="pager">
        <div className="pagerLeft">
          <Button className="btn" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button
            className="btn"
            disabled={busy || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
          <span className="subMuted">
            第 {page} / {totalPages} 页
          </span>
        </div>
        <div className="pagerRight">
          <span className="subMuted">每页</span>
          <Select
            className="input inputSm"
            value={String(pageSize)}
            onChange={(value) => {
              const next = Number.parseInt(String(value), 10);
              setPageSize(Number.isFinite(next) ? next : 20);
              setPage(1);
            }}
            disabled={busy}
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
            ]}
          >
          </Select>
        </div>
      </div>
    </div>
  );
}
