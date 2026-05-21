import Link from "next/link";

import { listHomeLatestArticles } from "@/services/article.service";
import { listHotTags } from "@/services/tag.service";

export default function PublicHomePage() {
  const articlesPromise = listHomeLatestArticles({ page: 1, pageSize: 6 });
  const hotTagsPromise = listHotTags(6);

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">用自然语言更快找到知识</h1>
        <p className="heroSub">支持关键词与语义混合检索的公开个人知识库。</p>
        <form className="heroRow" action="/search" data-testid="public-search-form">
          <input
            className="input"
            name="q"
            placeholder="比如：Redis 缓存一致性怎么做？"
            data-testid="public-search-input"
          />
          <button className="btn btnPrimary" type="submit">
            搜索
          </button>
        </form>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>最近更新</h3>
          <p>按发布时间展示最新文章。</p>
          <HomeLatest articlesPromise={articlesPromise} />
        </div>

        <div className="card">
          <h3>入口</h3>
          <p>公开浏览、个人登录注册与后台管理入口。</p>
          <div className="list">
            <div className="result">
              <div>
                <strong>文章列表</strong>
                <div className="resultMeta">按分类、标签与时间浏览</div>
              </div>
              <Link className="score" href="/articles">
                GO
              </Link>
            </div>
            <div className="result">
              <div>
                <strong>个人注册</strong>
                <div className="resultMeta">创建个人账号后，可查看自己的文章和审核状态</div>
              </div>
              <Link className="score" href="/auth?mode=register">
                JOIN
              </Link>
            </div>
            <div className="result">
              <div>
                <strong>个人登录</strong>
                <div className="resultMeta">已有账号可直接进入个人文章页</div>
              </div>
              <Link className="score" href="/auth?mode=login">
                LOGIN
              </Link>
            </div>
            <div className="result">
              <div>
                <strong>后台管理</strong>
                <div className="resultMeta">写作、发布、编辑与索引</div>
              </div>
              <Link className="score" href="/admin/login">
                ADMIN
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>热门标签</h3>
          <p>基于已发布文章聚合的常用主题标签。</p>
          <HomeHotTags hotTagsPromise={hotTagsPromise} />
        </div>
      </div>
    </main>
  );
}

async function HomeLatest(props: { articlesPromise: ReturnType<typeof listHomeLatestArticles> }) {
  const result = await props.articlesPromise.catch(() => null);
  if (!result) {
    return (
      <div className="list">
        <div className="result">
          <div>
            <strong>数据未就绪</strong>
            <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
          </div>
          <div className="score">DB</div>
        </div>
      </div>
    );
  }

  return (
    <div className="list" data-testid="home-latest-list">
      {result.items.map((a) => (
        <div key={a.id} className="result" data-testid="home-latest-item">
          <div>
            <strong>{a.title}</strong>
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
  );
}

async function HomeHotTags(props: { hotTagsPromise: ReturnType<typeof listHotTags> }) {
  const tags = await props.hotTagsPromise.catch(() => null);
  if (!tags) {
    return <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>数据未就绪</div>;
  }

  if (tags.length === 0) {
    return <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>暂无标签</div>;
  }

  return (
    <div className="list" style={{ marginTop: 0 }}>
      {tags.map((tag) => (
        <div key={tag.id} className="result">
          <div>
            <strong>{tag.name}</strong>
            <div className="resultMeta">快速筛选相关知识</div>
          </div>
          <Link className="score" href={`/articles?tag=${encodeURIComponent(tag.slug)}`}>
            TAG
          </Link>
        </div>
      ))}
    </div>
  );
}
