export type MatchField = 'inn' | 'kpp' | 'oktmo' | 'period' | 'year';

export const MATCH_FIELD_LABELS: Record<MatchField, string> = {
  inn: 'ИНН',
  kpp: 'КПП',
  oktmo: 'ОКТМО',
  period: 'Период',
  year: 'Отчётный год',
};

export const ALL_MATCH_FIELDS: MatchField[] = ['inn', 'kpp', 'oktmo', 'period', 'year'];

export interface ReportMeta {
  inn: string;
  kpp: string;
  oktmo: string;
  period: string;
  year: string;
}

function findAll(obj: any, key: string): any[] {
  let results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;
  if (obj[key]) {
    results = results.concat(Array.isArray(obj[key]) ? obj[key] : [obj[key]]);
  }
  for (const k in obj) {
    if (k !== '$' && k !== key && typeof obj[k] === 'object') {
      results = results.concat(findAll(obj[k], key));
    }
  }
  return results;
}

function getAttr(obj: any, tag: string, attr: string): string {
  const nodes = findAll(obj, tag);
  return (nodes[0]?.$?.[attr] ?? '').trim();
}

const parseNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function extractReportMeta(parsed: any): ReportMeta {
  return {
    inn: getAttr(parsed, 'НПЮЛ', 'ИННЮЛ') || getAttr(parsed, 'СвНП', 'ИННФЛ'),
    kpp: getAttr(parsed, 'НПЮЛ', 'КПП') || getAttr(parsed, 'СвНП', 'КПП'),
    oktmo:
      getAttr(parsed, 'СвОКТМО', 'ОКТМО') ||
      getAttr(parsed, 'СвНП', 'ОКТМО') ||
      getAttr(parsed, 'Документ', 'ОКТМО'),
    period: getAttr(parsed, 'Документ', 'Период'),
    year: getAttr(parsed, 'Документ', 'ОтчетГод'),
  };
}

/** СумНалУдерж из раздела 2 по КБК (отчёт прошлого периода). */
export function extractPrevSumNalUderzhByKbk(parsed: any): Record<string, number> {
  const byKbk: Record<string, number> = {};

  for (const r of findAll(parsed, 'РасчСумНал')) {
    const kbk = (r.$?.КБК ?? '').trim();
    if (!kbk) continue;
    byKbk[kbk] = Math.round(parseNum(r.$?.СумНалУдерж));
  }

  return byKbk;
}

/** Сопоставление текущего отчёта с отчётом прошлого периода (без учёта исключений и кода Период). */
export function previousPeriodReportMatches(
  current: ReportMeta,
  previous: ReportMeta,
): boolean {
  if (!current.inn || !previous.inn || current.inn !== previous.inn) return false;
  if (current.kpp && previous.kpp && current.kpp !== previous.kpp) return false;
  if (current.oktmo && previous.oktmo && current.oktmo !== previous.oktmo) return false;
  if (current.year && previous.year && current.year !== previous.year) return false;
  return true;
}

export function parseExcludedFields(raw: string | null): Set<MatchField> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((f): f is MatchField =>
        typeof f === 'string' && ALL_MATCH_FIELDS.includes(f as MatchField),
      ),
    );
  } catch {
    return new Set();
  }
}

function fieldMatches(
  field: MatchField,
  left: ReportMeta,
  right: ReportMeta,
  excluded: Set<MatchField>,
): boolean {
  if (excluded.has(field)) return true;

  switch (field) {
    case 'inn':
      return !left.inn || !right.inn || left.inn === right.inn;
    case 'kpp':
      return !left.kpp || !right.kpp || left.kpp === right.kpp;
    case 'oktmo':
      return !left.oktmo || !right.oktmo || left.oktmo === right.oktmo;
    case 'period':
      return left.period === right.period;
    case 'year':
      return left.year === right.year;
    default:
      return true;
  }
}

export function reportsMatch(
  left: ReportMeta,
  right: ReportMeta,
  excluded: Set<MatchField>,
): boolean {
  return ALL_MATCH_FIELDS.every((field) =>
    fieldMatches(field, left, right, excluded),
  );
}

export interface NotifRecord {
  inn: string;
  kpp: string;
  oktmo: string;
  period: string;
  year: string;
  kbk: string;
  slot: string;
  sum: number;
  docDate: string;
}

export function notificationMatchesReport(
  rec: NotifRecord,
  report: ReportMeta,
  excluded: Set<MatchField>,
): boolean {
  const recMeta: ReportMeta = {
    inn: rec.inn,
    kpp: rec.kpp,
    oktmo: rec.oktmo,
    period: rec.period,
    year: rec.year,
  };
  return reportsMatch(recMeta, report, excluded);
}

/** ДатаДок уведомления в миллисекундах. Пустая дата считается самой ранней. */
export function notificationDocDateValue(date: string): number {
  const trimmed = date.trim();
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    return Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Суммы уведомлений по КБК и сроку (НомерМесКварт).
 * Если на один срок несколько уведомлений, берётся сумма из уведомления
 * с самой поздней ДатаДок.
 */
export function collectLatestNotifSums(
  records: NotifRecord[],
  report: ReportMeta,
  excluded: Set<MatchField>,
): Record<string, Record<string, number>> {
  const fromNotif: Record<string, Record<string, number>> = {};
  const latestDate: Record<string, Record<string, number>> = {};

  for (const rec of records) {
    if (!notificationMatchesReport(rec, report, excluded) || !rec.kbk || !rec.slot) {
      continue;
    }

    const recTime = notificationDocDateValue(rec.docDate);
    const previousTime = latestDate[rec.kbk]?.[rec.slot];
    if (previousTime !== undefined && recTime < previousTime) continue;

    if (!fromNotif[rec.kbk]) fromNotif[rec.kbk] = {};
    if (!latestDate[rec.kbk]) latestDate[rec.kbk] = {};
    fromNotif[rec.kbk][rec.slot] = rec.sum;
    latestDate[rec.kbk][rec.slot] = recTime;
  }

  return fromNotif;
}
