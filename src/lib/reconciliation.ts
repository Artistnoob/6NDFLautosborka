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

export interface ProgressiveTaxRateResult {
  rate: 13 | 15 | 18 | 20 | 22;
  actual: number;
  expected: number;
  difference: number;
}

export interface ProgressiveTaxBaseResult {
  baseType: string;
  taxBase: number;
  rates: ProgressiveTaxRateResult[];
}

export interface ProgressiveTaxEmployeeResult {
  employee: string;
  bases: ProgressiveTaxBaseResult[];
}

export interface ProgressiveTaxCheckResult {
  employees: ProgressiveTaxEmployeeResult[];
  warnings: string[];
  rowCount: number;
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
    .filter(line => line.trim().length > 0);
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

export function parsePastedTable(text: string): string[][] {
  return splitRows(text);
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

const MAIN_BASE = 'Оплата труда (основная налоговая база)';
const NORTHERN_BASE = 'Районные, северные надбавки';

function canonicalBaseType(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes('оплата труда') || normalized.includes('основная налоговая база')) {
    return MAIN_BASE;
  }
  if (normalized.includes('районн') || normalized.includes('северн')) {
    return NORTHERN_BASE;
  }
  return value.trim();
}

function isKnownBaseType(value: string): boolean {
  const canonical = canonicalBaseType(value);
  return canonical === MAIN_BASE || canonical === NORTHERN_BASE;
}

function expectedProgressiveTax(baseType: string, taxBase: number): Record<number, number> {
  const base = Math.max(0, taxBase);
  if (canonicalBaseType(baseType) === NORTHERN_BASE) {
    return {
      13: Math.round(Math.min(base, 5_000_000) * 0.13),
      15: Math.round(Math.max(base - 5_000_000, 0) * 0.15),
      18: 0,
      20: 0,
      22: 0,
    };
  }

  return {
    13: Math.round(Math.min(base, 2_400_000) * 0.13),
    15: Math.round(Math.min(Math.max(base - 2_400_000, 0), 2_600_000) * 0.15),
    18: Math.round(Math.min(Math.max(base - 5_000_000, 0), 15_000_000) * 0.18),
    20: Math.round(Math.min(Math.max(base - 20_000_000, 0), 30_000_000) * 0.20),
    22: Math.round(Math.max(base - 50_000_000, 0) * 0.22),
  };
}

export function checkProgressiveTax(text: string): ProgressiveTaxCheckResult {
  const rows = splitRows(text);
  if (rows.length === 0) return { employees: [], warnings: [], rowCount: 0 };

  const requiredHeaders = {
    employee: ['Сотрудник', 'Физическое лицо', 'Физлицо'],
    baseType: ['Вид налоговой базы'],
    taxBase: ['Налоговая база'],
    tax13: ['Исчислено до превыш'],
    tax15: ['Исчислено с пр 15%'],
    tax18: ['Исчислено с пр 18%'],
    tax20: ['Исчислено с пр 20%'],
    tax22: ['Исчислено с пр 22%'],
  };
  const headerRowIndex = rows.slice(0, 20).findIndex(row =>
    findColumn(row, requiredHeaders.employee) >= 0 &&
    findColumn(row, requiredHeaders.taxBase) >= 0,
  );
  if (headerRowIndex < 0) {
    return {
      employees: [],
      warnings: ['Не найдена строка заголовков с колонками «Сотрудник» и «Налоговая база».'],
      rowCount: 0,
    };
  }

  let headerEndIndex = headerRowIndex;
  for (let index = headerRowIndex + 1; index < Math.min(rows.length, headerRowIndex + 5); index++) {
    const normalizedCells = rows[index].map(normalize);
    const isHeaderContinuation = normalizedCells.some(cell =>
      cell.includes('вид налоговой базы') ||
      cell.includes('исчислено до превыш') ||
      cell.includes('исчислено с пр'),
    );
    if (!isHeaderContinuation) break;
    headerEndIndex = index;
  }

  const headerRows = rows.slice(headerRowIndex, headerEndIndex + 1);
  const headerWidth = headerRows.reduce((max, row) => Math.max(max, row.length), 0);
  const header = Array.from({ length: headerWidth }, (_, column) =>
    headerRows
      .map(row => row[column] ?? '')
      .filter(Boolean)
      .join(' '),
  );
  const findRateColumn = (rate: 15 | 18 | 20 | 22) =>
    header.findIndex(value => {
      const normalized = normalize(value).replace(/[^а-яa-z0-9]+/g, ' ');
      return normalized.includes('исчислено с пр') &&
        new RegExp(`(^|\\s)${rate}(\\s|$)`).test(normalized);
    });
  const columns: Record<keyof typeof requiredHeaders, number> = {
    employee: findColumn(header, requiredHeaders.employee),
    baseType: findColumn(header, requiredHeaders.baseType),
    taxBase: findColumn(header, requiredHeaders.taxBase),
    tax13: findColumn(header, requiredHeaders.tax13),
    tax15: findRateColumn(15),
    tax18: findRateColumn(18),
    tax20: findRateColumn(20),
    tax22: findRateColumn(22),
  };
  const warnings: string[] = [];
  if (columns.tax13 < 0) warnings.push('Не найдена колонка «Исчислено до превыш».');
  for (const rate of [15, 18, 20, 22] as const) {
    if (columns[`tax${rate}`] < 0) warnings.push(`Не найдена колонка «Исчислено с пр ${rate}%».`);
  }

  interface TaxAggregate {
    employee: string;
    baseType: string;
    taxBase: number;
    actual: Record<number, number>;
  }
  const aggregates = new Map<string, TaxAggregate>();
  let rowCount = 0;
  let lastEmployee = '';
  const sharedHierarchyColumn = columns.employee === columns.baseType;

  for (const row of rows.slice(headerEndIndex + 1)) {
    const employeeCell = (row[columns.employee] ?? '').trim();
    const baseTypeCell = columns.baseType >= 0 ? (row[columns.baseType] ?? '').trim() : '';
    let employee = employeeCell;
    let rawBaseType = baseTypeCell;

    // В иерархической выгрузке 1С сотрудник указывается один раз,
    // а виды налоговой базы идут следующими строками. Иногда название
    // вида базы попадает прямо в колонку «Сотрудник».
    if (sharedHierarchyColumn && employeeCell && !isKnownBaseType(employeeCell)) {
      // Строка самого сотрудника содержит общий итог и служит заголовком
      // для вложенных строк видов базы. Общий итог не считаем повторно.
      if (!normalize(employeeCell).startsWith('итого')) lastEmployee = employeeCell;
      continue;
    } else if (isKnownBaseType(employeeCell)) {
      rawBaseType = employeeCell;
      employee = lastEmployee;
    } else if (employeeCell && !normalize(employeeCell).startsWith('итого')) {
      lastEmployee = employeeCell;
    } else if (!employeeCell) {
      employee = lastEmployee;
    }

    if (!employee || normalize(employee).startsWith('итого')) continue;

    const taxBaseValue = parseAmount(row[columns.taxBase] ?? '');
    const actualValues: Record<number, number | null> = {};
    for (const rate of [13, 15, 18, 20, 22] as const) {
      const column = columns[`tax${rate}`];
      actualValues[rate] = column >= 0 ? parseAmount(row[column] ?? '') : null;
    }
    const hasFinancialValues =
      taxBaseValue !== null ||
      Object.values(actualValues).some(value => value !== null);
    if (!hasFinancialValues) continue;

    const baseType = canonicalBaseType(rawBaseType) || MAIN_BASE;
    const taxBase = taxBaseValue ?? 0;
    const key = `${normalize(employee)}|${normalize(baseType)}`;
    const current = aggregates.get(key) ?? {
      employee,
      baseType,
      taxBase: 0,
      actual: { 13: 0, 15: 0, 18: 0, 20: 0, 22: 0 },
    };
    current.taxBase += taxBase;
    for (const rate of [13, 15, 18, 20, 22] as const) {
      current.actual[rate] += actualValues[rate] ?? 0;
    }
    aggregates.set(key, current);
    rowCount++;
  }

  const byEmployee = new Map<string, ProgressiveTaxEmployeeResult>();
  for (const aggregate of aggregates.values()) {
    const expected = expectedProgressiveTax(aggregate.baseType, aggregate.taxBase);
    const rates = ([13, 15, 18, 20, 22] as const)
      .map(rate => {
        const actual = Math.round(aggregate.actual[rate]);
        const expectedAmount = expected[rate];
        return {
          rate,
          actual,
          expected: expectedAmount,
          difference: expectedAmount - actual,
        };
      })
      .filter(item => item.actual !== 0 || item.expected !== 0);

    const employeeKey = normalize(aggregate.employee);
    const employeeResult = byEmployee.get(employeeKey) ?? {
      employee: aggregate.employee,
      bases: [],
    };
    employeeResult.bases.push({
      baseType: canonicalBaseType(aggregate.baseType) || MAIN_BASE,
      taxBase: Math.round(aggregate.taxBase * 100) / 100,
      rates,
    });
    byEmployee.set(employeeKey, employeeResult);
  }

  const employees = [...byEmployee.values()]
    .map(employee => ({
      ...employee,
      bases: employee.bases.sort((a, b) => a.baseType.localeCompare(b.baseType, 'ru')),
    }))
    .sort((a, b) => a.employee.localeCompare(b.employee, 'ru'));

  return { employees, warnings, rowCount };
}
