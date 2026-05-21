import type { SearchQueryType } from "@/types/search";

export default function SearchFilters(props: {
  queryType: SearchQueryType;
  total: number;
  visibleCount: number;
}) {
  return (
    <div className="card">
      <h3>统计</h3>
      <p>搜索会记录关键词与混合检索结果，便于后台分析。</p>
      <div className="list">
        <div className="result">
          <div>
            <strong>搜索类型</strong>
            <div className="resultMeta">{props.queryType}</div>
          </div>
          <div className="score">v1</div>
        </div>
        <div className="result">
          <div>
            <strong>结果数量</strong>
            <div className="resultMeta">{props.total}</div>
          </div>
          <div className="score">{props.visibleCount}</div>
        </div>
      </div>
    </div>
  );
}
