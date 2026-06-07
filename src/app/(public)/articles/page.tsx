import { redirect } from "next/navigation";
import { Button } from "antd";

import PublicArticleInfiniteList from "@/components/home/PublicArticleInfiniteList";
import { listPublishedArticles } from "@/services/article.service";

const PAGE_SIZE = 12;

function buildCanonicalUrl(input: { page: number; category?: string; tag?: string }) {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  if (input.category) params.set("category", input.category);
  if (input.tag) params.set("tag", input.tag);
  return `/articles?${params.toString()}`;
}

export default async function PublicArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const pageParam = sp.page;
  const hasExplicitPage = pageParam !== undefined;
  const isValidPageParam = pageParam ? /^[1-9]\d*$/.test(pageParam) : false;
  const page = hasExplicitPage && isValidPageParam ? Number.parseInt(pageParam, 10) : 1;
  const categorySlug = sp.category || undefined;
  const tagSlug = sp.tag || undefined;

  if (hasExplicitPage && !isValidPageParam) {
    redirect(buildCanonicalUrl({ page: 1, category: categorySlug, tag: tagSlug }));
  }

  const result = await listPublishedArticles({
    page,
    pageSize: PAGE_SIZE,
    categorySlug,
    tagSlug,
  }).catch(() => null);

  if (result) {
    const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    if (page > totalPages) {
      redirect(buildCanonicalUrl({ page: totalPages, category: categorySlug, tag: tagSlug }));
    }
  }

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">文章</h1>
        <p className="heroSub">按时间、分类与标签浏览公开内容。</p>
        <form className="heroRow" action="/search">
          <input className="input" name="q" placeholder="搜索文章…" />
          <Button className="btn btnPrimary" type="primary" htmlType="submit">
            搜索
          </Button>
        </form>
      </div>

      <div className="sectionPad">
        {!result ? (
          <div className="result">
            <div>
              <strong>数据未就绪</strong>
              <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
            </div>
            <div className="score">DB</div>
          </div>
        ) : (
          <PublicArticleInfiniteList
            initialItems={result.items}
            initialTotal={result.total}
            initialPage={page}
            pageSize={PAGE_SIZE}
            category={categorySlug}
            tag={tagSlug}
          />
        )}
      </div>
    </main>
  );
}

