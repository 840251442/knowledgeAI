"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";

import type { ApiResponse } from "@/types/api";
import type { ArticleListItem } from "@/types/article";

type PublicArticlesApiData = {
  items: ArticleListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type Props = {
  initialItems: ArticleListItem[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
  category?: string;
  tag?: string;
};

function buildArticleListApiUrl(input: {
  page: number;
  pageSize: number;
  category?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));
  if (input.category) params.set("category", input.category);
  if (input.tag) params.set("tag", input.tag);
  return `/api/articles?${params.toString()}`;
}

export default function PublicArticleInfiniteList(props: Props) {
  const [items, setItems] = useState(props.initialItems);
  const [total, setTotal] = useState(props.initialTotal);
  const [currentPage, setCurrentPage] = useState(props.initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);
  const itemIdsRef = useRef(new Set(props.initialItems.map((item) => item.id)));

  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  const loadNextPage = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;

    const nextPage = currentPage + 1;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        buildArticleListApiUrl({
          page: nextPage,
          pageSize: props.pageSize,
          category: props.category,
          tag: props.tag,
        }),
        { method: "GET", cache: "no-store" },
      );

      const body = (await response.json()) as ApiResponse<PublicArticlesApiData>;
      if (!response.ok || !body.success) {
        throw new Error(body.success ? "加载失败，请稍后重试" : body.error.message || "加载失败，请稍后重试");
      }

      const dedupedItems = body.data.items.filter((item) => {
        if (itemIdsRef.current.has(item.id)) return false;
        itemIdsRef.current.add(item.id);
        return true;
      });

      setItems((prev) => [...prev, ...dedupedItems]);
      setTotal(body.data.total);
      setCurrentPage(body.data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败，请稍后重试");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [currentPage, hasMore, props.category, props.pageSize, props.tag]);

  useEffect(() => {
    if (!hasMore || error) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting) {
        void loadNextPage();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, loadNextPage]);

  if (items.length === 0) {
    return <div className="meEmpty">暂无已发布文章</div>;
  }

  return (
    <>
      <div className="list listNoTopMargin">
        {items.map((a) => (
          <div key={a.id} className="result">
            <div>
              <strong>{a.title}</strong>
              <div className="resultExcerpt">{a.summary ?? "（无摘要）"}</div>
              <div className="resultMeta">
                {a.category.name} · 更新于 {a.updatedAt.slice(0, 10)}
              </div>
            </div>
            <Link className="score" href={`/articles/${a.slug}`}>
              OPEN
            </Link>
          </div>
        ))}
      </div>

      <div className="infiniteStatus" data-testid="public-infinite-status">
        {error ? (
          <>
            <span>{error}</span>
            <Button className="btn" onClick={() => void loadNextPage()} type="default">
              重试
            </Button>
          </>
        ) : isLoading ? (
          <span>正在加载更多…</span>
        ) : hasMore ? (
          <span>继续下滑加载更多</span>
        ) : (
          <span>已加载全部</span>
        )}
      </div>

      {hasMore && <div ref={sentinelRef} className="infiniteSentinel" data-testid="public-infinite-sentinel" />}
    </>
  );
}
