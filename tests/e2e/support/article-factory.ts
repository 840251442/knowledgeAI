export function buildE2EArticle() {
  const id = `${Date.now()}`;

  return {
    title: `缓存验收文章 ${id}`,
    slug: `cache-e2e-${id}`,
    summary: "初始摘要：旧内容",
    updatedSummary: "更新摘要：新内容",
    contentMarkdown: "# 缓存验收文章\n\n## 初始版本\n旧内容",
    updatedContentMarkdown:
      "# 缓存验收文章\n\n## 更新版本\n发布后先删旧缓存，再重新读取最新正文，避免旧缓存继续生效。",
    updatedSemanticQuery: "发布后怎么避免旧缓存继续生效",
  };
}
