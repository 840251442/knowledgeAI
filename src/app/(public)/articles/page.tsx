import Link from "next/link";

import { listPublishedArticles } from "@/services/article.service";

export default async function PublicArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const categorySlug = sp.category || undefined;
  const tagSlug = sp.tag || undefined;

  const result = await listPublishedArticles({
    page,
    pageSize: 12,
    categorySlug,
    tagSlug,
  }).catch(() => null);

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">文章</h1>
        <p className="heroSub">按时间、分类与标签浏览公开内容。</p>
        <form className="heroRow" action="/search">
          <input className="input" name="q" placeholder="搜索文章…" />
          <button className="btn btnPrimary" type="submit">
            搜索
          </button>
        </form>
      </div>

      <div style={{ padding: 16 }}>
        {!result ? (
          <div className="result">
            <div>
              <strong>数据未就绪</strong>
              <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
            </div>
            <div className="score">DB</div>
          </div>
        ) : (
          <div className="list" style={{ marginTop: 0 }}>
            {result.items.map((a) => (
              <div key={a.id} className="result">
                <div>
                  <strong>{a.title}</strong>
                  <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13, lineHeight: 1.4 }}>
                    {a.summary ?? "（无摘要）"}
                  </div>
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
        )}
      </div>
    </main>
  );
}

