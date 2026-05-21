export function parsePositiveInt(
  value: string | null,
  options?: { defaultValue?: number; max?: number; min?: number },
) {
  const defaultValue = options?.defaultValue ?? 1;
  const max = options?.max;
  const min = options?.min ?? 1;

  if (!value) return defaultValue;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return defaultValue;
  if (n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

