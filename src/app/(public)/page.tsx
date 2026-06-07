import { listPublishedArticles } from "@/services/article.service";
import { listHotTags } from "@/services/tag.service";
import HomeArticleFilter from "@/components/home/HomeArticleFilter";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  const articlesPromise = listPublishedArticles({ page: 1, pageSize: 60 });
  const hotTagsPromise = listHotTags(12);
  const [articles, hotTags] = await Promise.all([articlesPromise.catch(() => null), hotTagsPromise.catch(() => null)]);

  return (
    <main className="homePageStack">
      {!articles ? (
        <section className="panel homeListPanel">
          <div className="sectionPad">
            <div className="result heroSubWithTopMargin">
              <div>
                <strong>数据未就绪</strong>
                <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
              </div>
              <div className="score">DB</div>
            </div>
          </div>
        </section>
      ) : (
        <HomeArticleFilter articles={articles.items} hotTags={hotTags ?? []} />
      )}
    </main>
  );
}
