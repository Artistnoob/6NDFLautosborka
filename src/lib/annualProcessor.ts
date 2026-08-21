import {
  SLOT_TO_SEC1,
  SLOT_TO_SEC2,
} from '@/lib/xmlProcessor';
import {
  collectLatestNotifSums,
  previousPeriodReportMatches,
  type MatchField,
  type NotifRecord,
  type ReportMeta,
} from '@/lib/matching';
import { asArray, findAll, parseNum, roundRub } from '@/lib/xmlUtils';

const FIRST_FIVE_SLOTS = ['01', '11', '02', '12', '03'] as const;
const SIXTH_SLOT = '13';

interface CertRef {
  reportIndex: number;
  sumItNalPer: any;
  personKey: string;
  kbk: string;
  stavka: string;
  calculatedTax: number;
}

interface KbkRateTotals {
  sumDoh: number;
  sumVych: number;
  nalBaza: number;
  nalIschisl: number;
  nalUderzh: number;
  people: Set<string>;
}

export interface AnnualTaxIssue {
  personKey: string;
  inn: string;
  fullName: string;
  originalTotal: number;
  calculatedTotal: number;
  requestedTotal: number;
  remainingDiff: number;
  reportCount: number;
}

interface CertificateEntry {
  reportIndex: number;
  sprav: any;
  personKey: string;
}

function kbkRateKey(kbk: string, stavka: string): string {
  const numericRate = parseNum(stavka);
  return `${kbk}|${numericRate}`;
}

function buildPersonKey(poluchDoh: any): string {
  const attrs = poluchDoh.$ ?? {};
  const fio = poluchDoh.ФИО?.[0]?.$ ?? {};
  const ud = poluchDoh.УдЛичнФЛ?.[0]?.$ ?? {};
  return [
    attrs.ИННФЛ ?? '',
    attrs.Статус ?? '',
    attrs.ДатаРожд ?? '',
    attrs.Гражд ?? '',
    fio.Фамилия ?? '',
    fio.Имя ?? '',
    fio.Отчество ?? '',
    ud.КодУдЛичн ?? '',
    ud.СерНомДок ?? '',
  ].join('|');
}

function certificateIncome(sprav: any): number {
  let total = 0;
  for (const sved of asArray(sprav.СведДох)) {
    total += parseNum(sved.СумИтНалПер?.[0]?.$?.СумДохОбщ);
  }
  return Math.round(total * 100) / 100;
}

function certificateHasTransferableValues(sprav: any): boolean {
  for (const sved of asArray(sprav.СведДох)) {
    const sumIt = sved.СумИтНалПер?.[0]?.$;
    if (roundRub(parseNum(sumIt?.НалИсчисл)) !== 0) return true;
    if (sumDeductions(sved) !== 0) return true;
  }
  return false;
}

function addMoneyAttr(target: any, source: any, attr: string, digits = 0) {
  if (!target.$) target.$ = {};
  const value = parseNum(target.$[attr]) + parseNum(source?.$?.[attr]);
  target.$[attr] = digits === 2
    ? (Math.round(value * 100) / 100).toFixed(2)
    : String(roundRub(value));
}

function transferCertificateValues(source: any, target: any) {
  if (!target.СведДох) target.СведДох = [];

  for (const sourceSved of asArray(source.СведДох)) {
    const kbk = String(sourceSved.$?.КБК ?? '').trim();
    const stavka = String(sourceSved.$?.Ставка ?? '13').trim();
    const sourceSumIt = sourceSved.СумИтНалПер?.[0];
    if (!sourceSumIt) continue;

    let targetSved = asArray(target.СведДох).find((candidate: any) => {
      const candidateKbk = String(candidate.$?.КБК ?? '').trim();
      const candidateRate = String(candidate.$?.Ставка ?? '13').trim();
      return kbkRateKey(candidateKbk, candidateRate) === kbkRateKey(kbk, stavka);
    });

    if (!targetSved) {
      // У сотрудника есть доход в другой строке. Сохраняем отдельную строку
      // исходного КБК/ставки, чтобы налог и вычеты не попали в другой КБК.
      target.СведДох.push(sourceSved);
      continue;
    }

    const targetSumIt = targetSved.СумИтНалПер?.[0];
    if (!targetSumIt) {
      targetSved.СумИтНалПер = [sourceSumIt];
    } else {
      addMoneyAttr(targetSumIt, sourceSumIt, 'НалИсчисл');
      addMoneyAttr(targetSumIt, sourceSumIt, 'НалУдерж');
    }

    // Переносим вычеты с сохранением их кодов и исходной XML-структуры.
    if (sourceSved.НалВычССИ) {
      targetSved.НалВычССИ = [
        ...asArray(targetSved.НалВычССИ),
        ...asArray(sourceSved.НалВычССИ),
      ];
    }

    // В помесячных строках также могут находиться вычеты СвСумВыч.
    // Добавляем только те блоки ДохВыч, где такие вычеты действительно есть.
    for (const dohVych of asArray(sourceSved.ДохВыч)) {
      if (findAll(dohVych, 'СвСумВыч').length === 0) continue;
      targetSved.ДохВыч = [
        ...asArray(targetSved.ДохВыч),
        dohVych,
      ];
    }
  }
}

function removeCertificatesAndRenumber(obj: any, removed: Set<any>) {
  if (!obj || typeof obj !== 'object') return;

  if (obj.СправДох) {
    const kept = asArray(obj.СправДох).filter((sprav) => !removed.has(sprav));
    kept.forEach((sprav, index) => {
      if (!sprav.$) sprav.$ = {};
      sprav.$.НомСпр = String(index + 1);
    });
    obj.СправДох = kept;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$' || key === 'СправДох') continue;
    if (typeof value === 'object') removeCertificatesAndRenumber(value, removed);
  }
}

function prepareAnnualCertificates(parsedReports: any[]) {
  const entries: CertificateEntry[] = [];

  parsedReports.forEach((parsed, reportIndex) => {
    for (const sprav of findAll(parsed, 'СправДох')) {
      const poluch = sprav.ПолучДох?.[0];
      if (!poluch) continue;
      entries.push({
        reportIndex,
        sprav,
        personKey: buildPersonKey(poluch),
      });
    }
  });

  const entriesByPerson = new Map<string, CertificateEntry[]>();
  for (const entry of entries) {
    const list = entriesByPerson.get(entry.personKey) ?? [];
    list.push(entry);
    entriesByPerson.set(entry.personKey, list);
  }

  const removed = new Set<any>();
  for (const [personKey, personEntries] of entriesByPerson) {
    const withIncome = personEntries.filter(
      (entry) => Math.abs(certificateIncome(entry.sprav)) >= 0.005,
    );
    const withoutIncome = personEntries.filter(
      (entry) => Math.abs(certificateIncome(entry.sprav)) < 0.005,
    );

    for (const emptyEntry of withoutIncome) {
      if (certificateHasTransferableValues(emptyEntry.sprav)) {
        const target = withIncome[0];
        if (!target) {
          throw new Error(
            `У сотрудника ${personKey} есть налог или вычеты в справке без дохода, ` +
            'но среди загруженных отчётов нет его справки с доходом.',
          );
        }
        transferCertificateValues(emptyEntry.sprav, target.sprav);
      }
      removed.add(emptyEntry.sprav);
    }
  }

  for (const parsed of parsedReports) {
    removeCertificatesAndRenumber(parsed, removed);
  }
}

function getNalIschisl(sumItNalPer: any): number {
  return roundRub(parseNum(sumItNalPer?.$?.НалИсчисл));
}

function setCertTax(sumItNalPer: any, value: number) {
  if (!sumItNalPer.$) sumItNalPer.$ = {};
  const rounded = String(roundRub(value));
  sumItNalPer.$.НалИсчисл = rounded;
  sumItNalPer.$.НалУдерж = rounded;
  sumItNalPer.$.НалУдержЛиш = '0';
}

function clearCertificateExtras(spravDoh: any) {
  for (const sved of asArray(spravDoh.СведДох)) {
    const sumIt = sved.СумИтНалПер?.[0];
    if (sumIt?.$) {
      sumIt.$.НалУдержЛиш = '0';
    }
    for (const neUd of asArray(sved.СумДохНеУд)) {
      if (!neUd.$) neUd.$ = {};
      // Название элемента — СумДохНеУд, но налог хранится в атрибуте
      // СумНеУдНал. Доход, с которого налог не удержан, не изменяем.
      neUd.$.СумНеУдНал = '0';
      if ('СумНалНеУд' in neUd.$) neUd.$.СумНалНеУд = '0';
    }
  }
}

function sumNotifFirstFive(
  fromNotif: Record<string, Record<string, number>>,
  kbk: string,
): number {
  let total = 0;
  for (const slot of FIRST_FIVE_SLOTS) {
    total += roundRub(fromNotif[kbk]?.[slot] ?? 0);
  }
  return total;
}

function sumDeductions(svedDoh: any): number {
  let total = 0;

  // В строку 130 входят и стандартные/социальные/имущественные вычеты,
  // и вычеты, привязанные к помесячным доходам.
  for (const deduction of [
    ...findAll(svedDoh, 'ПредВычССИ'),
    ...findAll(svedDoh, 'СвСумВыч'),
  ]) {
    total += parseNum(deduction?.$?.СумВычет ?? deduction?.$?.СумВыч);
  }

  return Math.round(total * 100) / 100;
}

function collectCertRefs(parsedReports: any[]): CertRef[] {
  const refs: CertRef[] = [];

  parsedReports.forEach((parsed, reportIndex) => {
    for (const sprav of findAll(parsed, 'СправДох')) {
      const poluch = sprav.ПолучДох?.[0];
      if (!poluch) continue;
      const personKey = buildPersonKey(poluch);

      for (const sved of asArray(sprav.СведДох)) {
        const kbk = (sved.$?.КБК ?? '').trim();
        const stavka = String(sved.$?.Ставка ?? '13').trim();
        const sumIt = sved.СумИтНалПер?.[0];
        if (!kbk || !sumIt) continue;

        refs.push({
          reportIndex,
          sumItNalPer: sumIt,
          personKey,
          kbk,
          stavka,
          calculatedTax: 0,
        });
      }
    }
  });

  return refs;
}

function recalculateCertificates(
  refs: CertRef[],
  taxOverrides: Record<string, number>,
): AnnualTaxIssue[] {
  const originalByPerson = new Map<string, number>();

  for (const ref of refs) {
    originalByPerson.set(
      ref.personKey,
      (originalByPerson.get(ref.personKey) ?? 0) + getNalIschisl(ref.sumItNalPer),
    );
  }

  for (const ref of refs) {
    const stavka = parseNum(ref.stavka) / 100;
    const nalBaza = parseNum(ref.sumItNalPer.$?.НалБаза);
    const calculated = stavka > 0 ? roundRub(nalBaza * stavka) : 0;
    ref.calculatedTax = calculated;
    setCertTax(ref.sumItNalPer, calculated);
  }

  const refsByPerson = new Map<string, CertRef[]>();
  for (const ref of refs) {
    const list = refsByPerson.get(ref.personKey) ?? [];
    list.push(ref);
    refsByPerson.set(ref.personKey, list);
  }

  const issues: AnnualTaxIssue[] = [];
  for (const [personKey, personRefs] of refsByPerson) {
    const originalTotal = originalByPerson.get(personKey) ?? 0;
    const calculatedTotal = personRefs.reduce(
      (sum, ref) => sum + getNalIschisl(ref.sumItNalPer),
      0,
    );
    const override = taxOverrides[personKey];
    const target = Number.isFinite(override) ? roundRub(override) : originalTotal;
    let current = calculatedTotal;
    let diff = target - current;
    if (diff === 0) continue;

    const refsByReport = new Map<number, CertRef[]>();
    for (const ref of personRefs) {
      const list = refsByReport.get(ref.reportIndex) ?? [];
      list.push(ref);
      refsByReport.set(ref.reportIndex, list);
    }

    const reportIndexes = [...refsByReport.keys()].sort((a, b) => a - b);
    for (const reportIndex of reportIndexes) {
      if (diff === 0) break;
      const reportRefs = refsByReport.get(reportIndex) ?? [];
      const adjustment = diff > 0 ? 1 : -1;

      // На один отчёт и одного сотрудника допускается только одна
      // корректировка на 1 рубль. КБК выбирается среди блоков сотрудника,
      // где после корректировки сохраняется допуск ±1 рубль от расчёта.
      for (const ref of reportRefs) {
        const nextValue = getNalIschisl(ref.sumItNalPer) + adjustment;
        if (nextValue < 0 || Math.abs(nextValue - ref.calculatedTax) > 1) continue;

        setCertTax(ref.sumItNalPer, nextValue);
        diff -= adjustment;
        current += adjustment;
        break;
      }
    }

    if (diff !== 0) {
      const parts = personKey.split('|');
      issues.push({
        personKey,
        inn: parts[0] ?? '',
        fullName: [parts[4], parts[5], parts[6]].filter(Boolean).join(' '),
        originalTotal,
        calculatedTotal,
        requestedTotal: target,
        remainingDiff: diff,
        reportCount: refsByReport.size,
      });
    }
  }

  // Финальная синхронизация после распределения рублей. Это гарантирует,
  // что удержанный налог совпадает с исчисленным во всех справках, включая
  // блоки, в которые была внесена корректировка ±1 рубль.
  for (const ref of refs) {
    setCertTax(ref.sumItNalPer, getNalIschisl(ref.sumItNalPer));
  }

  return issues;
}

function aggregateReportTotals(parsed: any): Map<string, KbkRateTotals> {
  const totals = new Map<string, KbkRateTotals>();

  for (const sprav of findAll(parsed, 'СправДох')) {
    clearCertificateExtras(sprav);
    const poluch = sprav.ПолучДох?.[0];
    const personKey = poluch ? buildPersonKey(poluch) : '';

    for (const sved of asArray(sprav.СведДох)) {
      const kbk = (sved.$?.КБК ?? '').trim();
      const stavka = String(sved.$?.Ставка ?? '13').trim();
      const sumIt = sved.СумИтНалПер?.[0]?.$;
      if (!kbk || !sumIt) continue;

      const key = kbkRateKey(kbk, stavka);
      const current = totals.get(key) ?? {
        sumDoh: 0,
        sumVych: 0,
        nalBaza: 0,
        nalIschisl: 0,
        nalUderzh: 0,
        people: new Set<string>(),
      };

      current.sumDoh += parseNum(sumIt.СумДохОбщ);
      current.sumVych += sumDeductions(sved);
      current.nalBaza += parseNum(sumIt.НалБаза);
      const finalTax = roundRub(parseNum(sumIt.НалИсчисл));
      // Раздел 2 строится из окончательно выровненного налога справок.
      sumIt.НалУдерж = String(finalTax);
      current.nalIschisl += finalTax;
      current.nalUderzh += finalTax;
      if (personKey) current.people.add(personKey);
      totals.set(key, current);
    }
  }

  return totals;
}

function fillSectionsFromCertificates(parsed: any, totals: Map<string, KbkRateTotals>) {
  for (const r of findAll(parsed, 'РасчСумНал')) {
    if (!r.$) r.$ = {};
    const kbk = (r.$.КБК ?? '').trim();
    const stavka = String(r.$.Ставка ?? '13').trim();
    const agg = totals.get(kbkRateKey(kbk, stavka));

    r.$.СумНачислНач = (agg?.sumDoh ?? 0).toFixed(2);
    r.$.СумВыч = (agg?.sumVych ?? 0).toFixed(2);
    r.$.НалБаза = (agg?.nalBaza ?? 0).toFixed(2);
    r.$.СумНалИсч = String(agg?.nalIschisl ?? 0);
    r.$.СумНалУдерж = String(agg?.nalUderzh ?? 0);
    r.$.СумНалНеУдерж = '0';
    r.$.СумНалИзлУдерж = '0';
    r.$.КолФЛ = String(agg?.people.size ?? 0);
  }

  const sec1ByKbk = new Map<string, number>();
  for (const [key, agg] of totals) {
    const kbk = key.split('|')[0];
    sec1ByKbk.set(kbk, (sec1ByKbk.get(kbk) ?? 0) + agg.nalUderzh);
  }

  for (const ob of findAll(parsed, 'ОбязНА')) {
    if (!ob.$) ob.$ = {};
    const kbk = (ob.$.КБК ?? '').trim();
    const total = sec1ByKbk.get(kbk) ?? 0;
    ob.$.СумНалУд = String(roundRub(total));
  }
}

function applyNotificationsAndSixthTerm(
  parsed: any,
  fromNotif: Record<string, Record<string, number>>,
  prevSumByKbk: Record<string, number>,
) {
  for (const ob of findAll(parsed, 'ОбязНА')) {
    if (!ob.$) ob.$ = {};
    const kbk = (ob.$.КБК ?? '').trim();
    const sved = ob.СведСумНалУд?.[0];
    if (!sved) continue;
    if (!sved.$) sved.$ = {};

    for (const slot of FIRST_FIVE_SLOTS) {
      const attr = SLOT_TO_SEC1[slot];
      sved.$[attr] = String(roundRub(fromNotif[kbk]?.[slot] ?? 0));
    }

    const line160 = roundRub(parseNum(ob.$.СумНалУд));
    const notifFive = sumNotifFirstFive(fromNotif, kbk);
    const prev160 = roundRub(prevSumByKbk[kbk] ?? 0);
    const sixth = line160 - notifFive - prev160;
    sved.$[SLOT_TO_SEC1[SIXTH_SLOT]] = String(sixth);
  }

  for (const r of findAll(parsed, 'РасчСумНал')) {
    if (!r.$) r.$ = {};
    const kbk = (r.$.КБК ?? '').trim();

    for (const slot of FIRST_FIVE_SLOTS) {
      const attr = SLOT_TO_SEC2[slot];
      r.$[attr] = String(roundRub(fromNotif[kbk]?.[slot] ?? 0));
    }

    const line160 = roundRub(parseNum(r.$.СумНалУдерж));
    const notifFive = sumNotifFirstFive(fromNotif, kbk);
    const prev160 = roundRub(prevSumByKbk[kbk] ?? 0);
    const sixth = line160 - notifFive - prev160;
    r.$[SLOT_TO_SEC2[SIXTH_SLOT]] = String(sixth);
  }
}

function buildFromNotif(
  reportMeta: ReportMeta,
  allNotifRecords: NotifRecord[],
  excluded: Set<MatchField>,
): Record<string, Record<string, number>> {
  return collectLatestNotifSums(allNotifRecords, reportMeta, excluded);
}

function collectPrevSumForReport(
  reportMeta: ReportMeta,
  prevReports: { meta: ReportMeta; sumNalUderzhByKbk: Record<string, number> }[],
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const prev of prevReports) {
    if (!previousPeriodReportMatches(reportMeta, prev.meta)) continue;
    for (const [kbk, sum] of Object.entries(prev.sumNalUderzhByKbk)) {
      result[kbk] = (result[kbk] ?? 0) + sum;
    }
  }

  return result;
}

export function processAnnualReportsBatch(input: {
  parsedReports: any[];
  reportMetas: ReportMeta[];
  allNotifRecords: NotifRecord[];
  prevReports: { meta: ReportMeta; sumNalUderzhByKbk: Record<string, number> }[];
  excluded: Set<MatchField>;
  taxOverrides?: Record<string, number>;
}): AnnualTaxIssue[] {
  const {
    parsedReports,
    reportMetas,
    allNotifRecords,
    prevReports,
    excluded,
    taxOverrides = {},
  } = input;

  prepareAnnualCertificates(parsedReports);
  const certRefs = collectCertRefs(parsedReports);
  const issues = recalculateCertificates(certRefs, taxOverrides);
  if (issues.length > 0) return issues;

  parsedReports.forEach((parsed, index) => {
    const totals = aggregateReportTotals(parsed);
    fillSectionsFromCertificates(parsed, totals);

    const fromNotif = buildFromNotif(reportMetas[index], allNotifRecords, excluded);
    const prevSumByKbk = collectPrevSumForReport(reportMetas[index], prevReports);
    applyNotificationsAndSixthTerm(parsed, fromNotif, prevSumByKbk);
  });

  return [];
}
