import type { SearchResponse } from "@/types/search";

import SearchResultCard from "./SearchResultCard";

export default function SearchResults(props: {
  query: string;
  result: SearchResponse | null;
}) {
  if (!props.query) {
    return (
      <div className="result">
        <div>
          <strong>请输入搜索词</strong>
          <div className="resultMeta">支持关键词与自然语言混合检索</div>
        </div>
        <div className="score">TIP</div>
      </div>
    );
  }

  if (!props.result) {
    return (
      <div className="result">
        <div>
          <strong>数据未就绪</strong>
          <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
        </div>
        <div className="score">DB</div>
      </div>
    );
  }

  if (props.result.items.length === 0) {
    return (
      <div className="result">
        <div>
          <strong>没有找到结果</strong>
          <div className="resultMeta">尝试换个关键词或更短的查询</div>
        </div>
        <div className="score">0</div>
      </div>
    );
  }

  return (
    <>
      {props.result.items.map((item) => (
        <SearchResultCard key={item.articleId} item={item} query={props.query} />
      ))}
    </>
  );
}
