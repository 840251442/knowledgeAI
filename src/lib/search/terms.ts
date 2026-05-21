export function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractTerms(input: string) {
  const normalized = normalizeText(input);
  const terms = new Set<string>();

  for (const token of normalized.match(/[a-z0-9]{2,}/g) ?? []) {
    terms.add(token);
  }

  for (const token of normalized.match(/[\p{Script=Han}]{1,}/gu) ?? []) {
    if (token.length === 1) {
      terms.add(token);
      continue;
    }

    for (let i = 0; i < token.length - 1; i += 1) {
      terms.add(token.slice(i, i + 2));
    }

    if (token.length <= 4) {
      terms.add(token);
    }
  }

  return Array.from(terms);
}

export function overlapScore(queryTerms: string[], targetTerms: Iterable<string>) {
  const targetSet = new Set(targetTerms);
  if (queryTerms.length === 0 || targetSet.size === 0) return 0;

  let overlap = 0;
  for (const term of queryTerms) {
    if (targetSet.has(term)) overlap += 1;
  }

  return overlap / queryTerms.length;
}
