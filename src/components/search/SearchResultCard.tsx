import { Button } from "antd";

import type { SearchResultItem } from "@/types/search";

import { HighlightedText } from "./highlight";

export default function SearchResultCard(props: {
  item: SearchResultItem;
  query: string;
}) {
  const excerpt = props.item.excerpt ?? "（无摘要片段）";

  return (
    <div className="result" data-testid="search-result-card">
      <div>
        <strong data-testid="search-result-title">
          <HighlightedText query={props.query} testId="search-highlight" text={props.item.title} />
        </strong>
        <div data-testid="search-result-excerpt" className="resultExcerpt">
          <HighlightedText query={props.query} testId="search-highlight" text={excerpt} />
        </div>
        <div className="resultMeta">
          {props.item.category.name} · 分数 {props.item.score.toFixed(2)}
        </div>
      </div>
      <Button className="score" href={`/articles/${props.item.slug}`}>
        OPEN
      </Button>
    </div>
  );
}
