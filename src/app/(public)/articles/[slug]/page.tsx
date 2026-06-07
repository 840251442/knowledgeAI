import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "antd";

import ArticleCommentSection from "@/components/home/ArticleCommentSection";
import { requireUser } from "@/lib/auth/require-user";
import { extractHeadings } from "@/lib/markdown/headings";
import { slugifyHeading } from "@/lib/markdown/slug";
import { getPublishedArticleBySlug, listPublishedArticles } from "@/services/article.service";
import { listPublishedComments } from "@/services/comment.service";

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
          <div className="heroRow heroActionsRow">
            <Button className="btn" href="/articles">
              返回文章列表
            </Button>
            <Button className="btn btnPrimary" href="/search" type="primary">
              去搜索
            </Button>
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

  const [commentSummary, personalUser, adminUser] = await Promise.all([
    listPublishedComments(slug).catch(() => null),
    requireUser("PERSONAL"),
    requireUser("ADMIN"),
  ]);

  const currentUser = adminUser?.role === "ADMIN"
    ? {
        id: adminUser.id,
        role: "ADMIN" as const,
        displayName: adminUser.username || adminUser.email,
      }
    : personalUser?.role === "PERSONAL"
      ? {
          id: personalUser.id,
          role: "PERSONAL" as const,
          displayName: personalUser.email ?? personalUser.phone ?? "已登录用户",
        }
      : null;

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
        <div className="card cardNoPad">
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

        <div className="card cardNoPad">
          <div className="toc" data-testid="article-detail-toc">
            <h4>目录</h4>
            {headings.length === 0 ? (
              <div className="tocEmpty">无标题结构</div>
            ) : (
              headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} className={h.depth === 3 ? "tocLink tocLinkDepth3" : "tocLink"}>
                  {h.text}
                </a>
              ))
            )}
          </div>
          <div className="toc tocDivider">
            <h4>相关推荐</h4>
            <RelatedArticles currentSlug={slug} relatedPromise={relatedPromise} />
          </div>
        </div>
      </div>

      <div className="articleCommentsWrap">
        <ArticleCommentSection
          slug={slug}
          commentStatus={commentSummary?.commentStatus ?? article.commentStatus}
          initialComments={commentSummary?.items ?? []}
          currentUser={currentUser}
        />
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
    return <div className="tocEmpty">数据未就绪</div>;
  }

  const items = result.items.filter((x) => x.slug !== props.currentSlug).slice(0, 4);
  if (items.length === 0) {
    return <div className="tocEmpty">暂无</div>;
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
