export type ReconciliationMetric = 'income' | 'tax';
export type ReconciliationDimension = 'employee' | 'registrar';

export interface ReconciliationRow {
  key: string;
  label: string;
  salaryAmount: number;
  ndflAmount: number;
  difference: number;
  status: 'mismatch' | 'salary-only' | 'ndfl-only';
}

export interface ReconciliationResult {
  rows: ReconciliationRow[];
  salaryCount: number;
  ndflCount: number;
  warnings: string[];
}

interface ParsedRecord {
  key: string;
  label: string;
  amount: number;
}

interface AggregatedRecord {
  amount: number;
  labels: Set<string>;
}

const MONTHS: Record<string, string> = {
  январь: '01', января: '01',
  февраль: '02', февраля: '02',
  март: '03', марта: '03',
  апрель: '04', апреля: '04',
  май: '05', мая: '05',
  июнь: '06', июня: '06',
  июль: '07', июля: '07',
  август: '08', августа: '08',
  сентябрь: '09', сентября: '09',
  октябрь: '10', октября: '10',
  ноябрь: '11', ноября: '11',
  декабрь: '12', декабря: '12',
};

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/ё/g, 'е')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/[₽р]/gi, '')
    .replace(',', '.')
    .replace(/^\((.*)\)$/, '-$1');
  if (!cleaned || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function splitRows(text: string): string[][] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sample = lines.slice(0, 5).join('\n');
  const delimiter = sample.includes('\t')
    ? '\t'
    : sample.includes(';')
      ? ';'
      : '';

  if (delimiter) return lines.map(line => splitDelimitedLine(line, delimiter));

  return lines.map(line => {
    const match = line.match(/^(.*?)[\s]{2,}(-?[\d\s]+(?:[,.]\d+)?)\s*$/);
    return match ? [match[1].trim(), match[2].trim()] : [line];
  });
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalize);
  for (const candidate of candidates.map(normalize)) {
    const exact = normalized.findIndex(header => header === candidate);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates.map(normalize)) {
    const partial = normalized.findIndex(header => header.includes(candidate));
    if (partial >= 0) return partial;
  }
  return -1;
}

function extractMonth(documentName: string): string {
  const date = documentName.match(/\b\d{1,2}[./-](\d{1,2})[./-](\d{4})\b/);
  if (date) return `${date[1].padStart(2, '0')}.${date[2]}`;

  const normalized = normalize(documentName);
  const year = normalized.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return '';
  for (const [name, month] of Object.entries(MONTHS)) {
    if (normalized.includes(name)) return `${month}.${year}`;
  }
  return '';
}

function registrarKey(label: string): string {
  const normalized = normalize(label);
  const payroll = normalized.includes('начисление зарплаты и взносов');
  const halfMonth = normalized.includes('начисление за первую половину месяца');
  if (payroll || halfMonth) {
    const month = extractMonth(label);
    if (month) return `payroll|${month}`;
  }
  return `document|${normalized}`;
}

function parseRecords(input: {
  text: string;
  side: 'salary' | 'ndfl';
  metric: ReconciliationMetric;
  dimension: ReconciliationDimension;
  ndflAmountHeader?: string;
}): { records: ParsedRecord[]; warnings: string[] } {
  const { text, side, metric, dimension, ndflAmountHeader } = input;
  const rows = splitRows(text);
  if (rows.length === 0) return { records: [], warnings: [] };

  const keyHeaders = dimension === 'employee'
    ? ['Сотрудник', 'Физическое лицо', 'Физлицо']
    : ['Регистратор', 'Документ'];
  const amountHeaders = side === 'ndfl'
    ? ndflAmountHeader
      ? [ndflAmountHeader]
      : metric === 'income'
        ? ['Начислено']
        : ['Исчислено до превыш']
    : metric === 'income'
      ? ['Начислено', 'Сумма', 'Доход']
      : ['Исчислено до превыш', 'Исчислено', 'НДФЛ', 'Сумма'];

  const headerRowIndex = rows.slice(0, 20).findIndex(row =>
    findColumn(row, keyHeaders) >= 0 && findColumn(row, amountHeaders) >= 0,
  );
  const header = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  let keyIndex = findColumn(header, keyHeaders);
  let amountIndex = findColumn(header, amountHeaders);
  const hasHeader = headerRowIndex >= 0 || keyIndex >= 0 || amountIndex >= 0;
  const warnings: string[] = [];

  if (keyIndex < 0) {
    keyIndex = 0;
    if (hasHeader) warnings.push(`Не найдена колонка «${keyHeaders[0]}», используется первая колонка.`);
  }
  if (amountIndex < 0) {
    amountIndex = Math.max(1, header.length - 1);
    if (hasHeader) warnings.push(`Не найдена колонка «${amountHeaders[0]}», используется последняя колонка.`);
  }

  const records: ParsedRecord[] = [];
  const dataStart = headerRowIndex >= 0 ? headerRowIndex + 1 : hasHeader ? 1 : 0;
  for (const row of rows.slice(dataStart)) {
    const label = (row[keyIndex] ?? '').trim();
    const amount = parseAmount(row[amountIndex] ?? '');
    if (!label || amount === null) continue;
    records.push({
      key: dimension === 'registrar' ? registrarKey(label) : normalize(label),
      label,
      amount,
    });
  }

  return { records, warnings };
}

function aggregate(records: ParsedRecord[]): Map<string, AggregatedRecord> {
  const result = new Map<string, AggregatedRecord>();
  for (const record of records) {
    const current = result.get(record.key) ?? { amount: 0, labels: new Set<string>() };
    current.amount += record.amount;
    current.labels.add(record.label);
    result.set(record.key, current);
  }
  return result;
}

export function compareReconciliation(input: {
  salaryText: string;
  ndflText: string;
  metric: ReconciliationMetric;
  dimension: ReconciliationDimension;
  ndflAmountHeader?: string;
}): ReconciliationResult {
  const salaryParsed = parseRecords({ ...input, text: input.salaryText, side: 'salary' });
  const ndflParsed = parseRecords({ ...input, text: input.ndflText, side: 'ndfl' });
  const salary = aggregate(salaryParsed.records);
  const ndfl = aggregate(ndflParsed.records);
  const keys = new Set([...salary.keys(), ...ndfl.keys()]);
  const rows: ReconciliationRow[] = [];

  for (const key of keys) {
    const left = salary.get(key);
    const right = ndfl.get(key);
    const salaryAmount = left?.amount ?? 0;
    const ndflAmount = right?.amount ?? 0;
    const difference = Math.round((salaryAmount - ndflAmount) * 100) / 100;
    if (Math.abs(difference) < 0.005) continue;

    const labels = left?.labels.size
      ? [...left.labels]
      : right?.labels.size
        ? [...right.labels]
        : [key];
    rows.push({
      key,
      label: labels.join(' + '),
      salaryAmount: Math.round(salaryAmount * 100) / 100,
      ndflAmount: Math.round(ndflAmount * 100) / 100,
      difference,
      status: !left ? 'ndfl-only' : !right ? 'salary-only' : 'mismatch',
    });
  }

  rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return {
    rows,
    salaryCount: salaryParsed.records.length,
    ndflCount: ndflParsed.records.length,
    warnings: [...salaryParsed.warnings, ...ndflParsed.warnings],
  };
}
