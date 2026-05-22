"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "antd";

import type { ArticleListItem, TagSummary } from "@/types/article";

function includesQuery(article: ArticleListItem, q: string) {
  const text = [
    article.title,
    article.summary ?? "",
    article.category.name,
    ...article.tags.map((tag) => tag.name),
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(q);
}

export default function HomeArticleFilter(props: {
  articles: ArticleListItem[];
  hotTags: TagSummary[];
}) {
  const [query, setQuery] = useState("");
  const [activeTagSlugs, setActiveTagSlugs] = useState<string[]>([]);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return props.articles.filter((article) => {
      const matchesQuery = !normalizedQuery || includesQuery(article, normalizedQuery);
      const matchesTags =
        activeTagSlugs.length === 0 || article.tags.some((tag) => activeTagSlugs.includes(tag.slug));
      return matchesQuery && matchesTags;
    });
  }, [props.articles, normalizedQuery, activeTagSlugs]);

  function toggleTag(slug: string) {
    setActiveTagSlugs((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));
  }

  return (
    <>
      <section className="panel homeSearchPanel">
        <div className="sectionPad">
          <form
            className="heroRow"
            data-testid="public-search-form"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input
              className="input"
              name="q"
              placeholder="比如：Redis 缓存一致性怎么做？"
              data-testid="public-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button className="btn btnPrimary" type="primary" htmlType="submit">
              搜索
            </Button>
          </form>

          {props.hotTags.length === 0 ? (
            <p className="heroSub heroSubWithTopMargin">暂无热门标签</p>
          ) : (
            <div className="hotTagsRow" aria-label="热门标签">
              <span className="hotTagsLabel">热门标签</span>
              {props.hotTags.map((tag) => {
                const active = activeTagSlugs.includes(tag.slug);
                return (
                  <Button
                    key={tag.id}
                    className={active ? "hotTag hotTagActive" : "hotTag"}
                    htmlType="button"
                    onClick={() => toggleTag(tag.slug)}
                  >
                    #{tag.name}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="homeListPanel">
        <div className="homeFilterList">
        {filtered.length === 0 ? (
          <div className="result">
            <div>
              <strong>没有匹配内容</strong>
              <div className="resultMeta">试试减少关键词，或切换标签组合</div>
            </div>
            <div className="score">0</div>
          </div>
        ) : (
          <div className="list listNoTopMargin" data-testid="home-latest-list">
            {filtered.map((article) => (
              <div key={article.id} className="result" data-testid="home-latest-item">
                <div>
                  <strong>{article.title}</strong>
                  <div className="resultExcerpt">{article.summary ?? "（无摘要）"}</div>
                  <div className="resultMeta">
                    {article.category.name} · 更新于 {article.updatedAt.slice(0, 10)}
                  </div>
                </div>
                <Link className="score" href={`/articles/${article.slug}`}>
                  OPEN
                </Link>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
    </>
  );
}
