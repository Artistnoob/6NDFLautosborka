import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { updateReport } from '@/lib/xmlProcessor';

// ─── Утилиты ────────────────────────────────────────────────────────────────

/** Рекурсивный поиск всех элементов с заданным тегом в объекте xml2js */
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

/** Достать первый атрибут из первого найденного элемента с тегом key */
function getAttr(obj: any, tag: string, attr: string): string | undefined {
  const nodes = findAll(obj, tag);
  return nodes[0]?.$?.[attr];
}

// ─── Парсинг уведомления ─────────────────────────────────────────────────────

interface NotifRecord {
  inn:    string;
  kpp:    string;
  oktmo:  string;
  period: string;
  year:   string;
  kbk:    string;
  slot:   string;
  sum:    number;
}

/**
 * Из одного распарсенного уведомления достаём все строки УвИсчСумНалог
 * вместе с реквизитами организации.
 *
 * Структура уведомления (упрощённо):
 * Файл
 *   СвНП
 *     НПЮЛ[@ИННЮЛ, @КПП]
 *   Документ
 *     УвИсчСумНалог[@КБК, @КППДекл, @ОКТМО, @Период, @Год, @НомерМесКварт, @СумНалогАванс]
 */
function extractNotifRecords(notif: any): NotifRecord[] {
  const records: NotifRecord[] = [];

  // ИНН организации — ищем НПЮЛ рекурсивно (структура может различаться)
  const inn = getAttr(notif, 'НПЮЛ', 'ИННЮЛ') ?? '';

  const uvItems = findAll(notif, 'УвИсчСумНалог');
  for (const u of uvItems) {
    const a = u.$ ?? {};
    records.push({
      inn,
      kpp:    a.КППДекл        ?? '',
      oktmo:  a.ОКТМО          ?? '',
      period: a.Период         ?? '',
      year:   a.Год            ?? '',
      kbk:    a.КБК            ?? '',
      slot:   a.НомерМесКварт  ?? '',
      sum:    parseInt(a.СумНалогАванс ?? '0', 10),
    });
  }
  return records;
}

// ─── Реквизиты отчёта ────────────────────────────────────────────────────────

interface ReportMeta {
  inn:    string;
  kpp:    string;
  oktmo:  string;
  period: string;
  year:   string;
}

/**
 * Достаём реквизиты отчёта 6-НДФЛ.
 *
 * Структура отчёта (упрощённо):
 * Файл
 *   СвНП
 *     НПЮЛ[@ИННЮЛ, @КПП]
 *     СвОКТМО[@ОКТМО]   — или ОКТМО прямо в СвНП
 *   Документ[@Период, @ОтчетГод]
 */
function extractReportMeta(report: any): ReportMeta {
  const inn    = getAttr(report, 'НПЮЛ',    'ИННЮЛ')   ?? '';
  const kpp    = getAttr(report, 'НПЮЛ',    'КПП')     ?? '';
  const oktmo  = getAttr(report, 'СвОКТМО', 'ОКТМО')
              ?? getAttr(report, 'СвНП',    'ОКТМО')
              ?? getAttr(report, 'НаимОрг', 'ОКТМО')
              ?? '';
  const period = getAttr(report, 'Документ', 'Период')   ?? '';
  const year   = getAttr(report, 'Документ', 'ОтчетГод') ?? '';

  return { inn, kpp, oktmo, period, year };
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData    = await req.formData();
    const reportFiles = formData.getAll('reports')       as File[];
    const notifFiles  = formData.getAll('notifications') as File[];

    if (reportFiles.length === 0) throw new Error('Отчёты не выбраны');

    // 1. Парсим все уведомления → плоский список строк NotifRecord
    const allNotifRecords: NotifRecord[] = [];
    for (const f of notifFiles) {
      const buf    = Buffer.from(await f.arrayBuffer());
      const xml    = iconv.decode(buf, 'win1251');
      const parsed = await xml2js.parseStringPromise(xml);
      allNotifRecords.push(...extractNotifRecords(parsed));
    }

    console.log(`Загружено строк из уведомлений: ${allNotifRecords.length}`);

    // 2. Обрабатываем каждый отчёт отдельно
    const resultFiles: { name: string; data: string }[] = [];

    for (const reportFile of reportFiles) {
      const buf    = Buffer.from(await reportFile.arrayBuffer());
      const xml    = iconv.decode(buf, 'win1251');
      const parsed = await xml2js.parseStringPromise(xml);

      // Реквизиты этого конкретного отчёта
      const meta = extractReportMeta(parsed);
      console.log(`Отчёт "${reportFile.name}": ИНН=${meta.inn} КПП=${meta.kpp} ОКТМО=${meta.oktmo} Период=${meta.period} Год=${meta.year}`);

      // 3. Фильтруем строки уведомлений строго по реквизитам этого отчёта
      const fromNotif: Record<string, Record<string, number>> = {};

      for (const rec of allNotifRecords) {
        if (meta.inn    && rec.inn    !== meta.inn)    continue;
        if (meta.kpp    && rec.kpp    !== meta.kpp)    continue;
        if (meta.oktmo  && rec.oktmo  !== meta.oktmo)  continue;
        if (meta.period && rec.period !== meta.period) continue;
        if (meta.year   && rec.year   !== meta.year)   continue;

        if (!rec.kbk || !rec.slot) continue;

        if (!fromNotif[rec.kbk]) fromNotif[rec.kbk] = {};
        fromNotif[rec.kbk][rec.slot] = (fromNotif[rec.kbk][rec.slot] ?? 0) + rec.sum;
      }

      console.log(`  Совпавших строк: ${Object.values(fromNotif).reduce((a, v) => a + Object.keys(v).length, 0)}`);
      console.log(`  fromNotif:`, JSON.stringify(fromNotif));

      // 4. Обновляем отчёт только его данными из уведомлений
      updateReport(parsed, fromNotif);

      // 5. Сериализуем обратно в XML → win1251 → base64
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'windows-1251' },
        renderOpts: { pretty: true, indent: '\t' },
      });
      const xmlString   = builder.buildObject(parsed);
      const finalBuffer = iconv.encode(xmlString, 'win1251');

      resultFiles.push({
        name: reportFile.name,
        data: finalBuffer.toString('base64'),
      });
    }

    // 6. Возвращаем JSON-массив всех файлов
    return new Response(JSON.stringify({ files: resultFiles }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}