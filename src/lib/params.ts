export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function pageParam(sp: SearchParams) {
  const n = Number(param(sp, "page") ?? 1);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function oneOf<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  return options.includes(value as T) ? (value as T) : undefined;
}

export const PAGE_SIZE = 25;
