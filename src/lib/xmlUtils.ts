export function findAll(obj: any, key: string): any[] {
  let results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;

  if (obj[key]) {
    results = results.concat(Array.isArray(obj[key]) ? obj[key] : [obj[key]]);
  }

  for (const k in obj) {
    if (typeof obj[k] === 'object' && k !== '$' && k !== key) {
      results = results.concat(findAll(obj[k], key));
    }
  }
  return results;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export const parseNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export const roundRub = (value: number): number => Math.round(value);
