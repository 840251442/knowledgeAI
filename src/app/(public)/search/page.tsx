import SearchBox from "@/components/search/SearchBox";
import SearchFilters from "@/components/search/SearchFilters";
import SearchResults from "@/components/search/SearchResults";

import { searchArticles } from "@/services/search.service";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const result = q ? await searchArticles({ q, page: 1, pageSize: 20 }).catch(() => null) : null;

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">搜索</h1>
        <p className="heroSub">输入关键词或自然语言问题，返回站内内容匹配结果。</p>
        <SearchBox defaultValue={q} />
      </div>

      <div className="twoCol">
        <div>
          <div className="list listNoTopMargin">
            <SearchResults query={q} result={result} />
          </div>
        </div>
        <div>
          <SearchFilters
            queryType={result?.queryType ?? "KEYWORD"}
            total={result?.total ?? 0}
            visibleCount={result?.items.length ?? 0}
          />
        </div>
      </div>
    </main>
  );
}
