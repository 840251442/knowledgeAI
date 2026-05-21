import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { extractHeadings } from "@/lib/markdown/headings";
import { slugifyHeading } from "@/lib/markdown/slug";
import { getPublishedArticleBySlug, listPublishedArticles } from "@/services/article.service";

type RelatedPromise = Promise<Awaited<ReturnType<typeof listPublishedArticles>> | null>;

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await getPublishedArticleBySlug(slug).catch(() => null);
  if (!article) {
    return (
      <main className="panel">
        <div className="hero">
          <h1 className="heroTitle">未找到文章</h1>
          <p className="heroSub">请确认链接是否正确，或返回文章列表。</p>
          <div className="heroRow" style={{ gridTemplateColumns: "auto auto" }}>
            <Link className="btn" href="/articles">
              返回文章列表
            </Link>
            <Link className="btn btnPrimary" href="/search">
              去搜索
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const headings = extractHeadings(article.contentMarkdown).filter((h) => h.depth <= 3);
  const relatedPromise: RelatedPromise = listPublishedArticles({
    page: 1,
    pageSize: 8,
    categorySlug: article.category.slug,
  }).catch(() => null);

  return (
    <main className="panel">
      <div className="articleTitle" data-testid="article-detail-header">
        <h1 data-testid="article-detail-title">{article.title}</h1>
        <div className="articleSub">
          <span>分类：{article.category.name}</span>
          <span>更新时间：{article.updatedAt.slice(0, 10)}</span>
          <span>状态：{article.status}</span>
        </div>
      </div>

      <div className="twoCol">
        <div className="card" style={{ padding: 0 }}>
          <div className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => {
                  const text = String(props.children ?? "");
                  const id = slugifyHeading(text);
                  return <h1 id={id}>{props.children}</h1>;
                },
                h2: (props) => {
                  const text = String(props.children ?? "");
                  const id = slugifyHeading(text);
                  return <h2 id={id}>{props.children}</h2>;
                },
                h3: (props) => {
                  const text = String(props.children ?? "");
                  const id = slugifyHeading(text);
                  return <h3 id={id}>{props.children}</h3>;
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
              {article.contentMarkdown}
            </ReactMarkdown>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="toc" data-testid="article-detail-toc">
            <h4>目录</h4>
            {headings.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>无标题结构</div>
            ) : (
              headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} style={{ paddingLeft: h.depth === 3 ? 18 : 10 }}>
                  {h.text}
                </a>
              ))
            )}
          </div>
          <div className="toc" style={{ borderTop: "1px solid rgba(255,255,255,.10)" }}>
            <h4>相关推荐</h4>
            <RelatedArticles currentSlug={slug} relatedPromise={relatedPromise} />
          </div>
        </div>
      </div>
    </main>
  );
}

async function RelatedArticles(props: {
  currentSlug: string;
  relatedPromise: RelatedPromise;
}) {
  const result = await props.relatedPromise;
  if (!result) {
    return <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>数据未就绪</div>;
  }

  const items = result.items.filter((x) => x.slug !== props.currentSlug).slice(0, 4);
  if (items.length === 0) {
    return <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>暂无</div>;
  }

  return (
    <>
      {items.map((a) => (
        <Link key={a.id} href={`/articles/${a.slug}`}>
          {a.title}
        </Link>
      ))}
    </>
  );
}
