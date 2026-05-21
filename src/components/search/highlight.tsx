import { Fragment } from "react";

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractHighlightTerms(query: string) {
  const terms = query
    .toLowerCase()
    .split(/[\s,.;:!?/\\()[\]{}"-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  return Array.from(new Set(terms));
}

export function HighlightedText(props: {
  text: string;
  query: string;
  testId?: string;
}) {
  const terms = extractHighlightTerms(props.query);
  if (!props.text || terms.length === 0) return <>{props.text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = props.text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const matched = terms.some((term) => term === part.toLowerCase());
        if (!matched) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
        return (
          <mark key={`${part}-${index}`} data-testid={props.testId}>
            {part}
          </mark>
        );
      })}
    </>
  );
}
