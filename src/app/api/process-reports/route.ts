import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { updateReport } from '@/lib/xmlProcessor';
import {
  extractPrevSumNalUderzhByKbk,
  extractReportMeta,
  notificationMatchesReport,
  parseExcludedFields,
  previousPeriodReportMatches,
  type NotifRecord,
  type ReportMeta,
} from '@/lib/matching';

export const maxDuration = 180;

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

function getAttr(obj: any, tag: string, attr: string): string | undefined {
  const nodes = findAll(obj, tag);
  return nodes[0]?.$?.[attr]?.trim();
}

function extractNotifRecords(notif: any): NotifRecord[] {
  const records: NotifRecord[] = [];
  const inn = getAttr(notif, 'НПЮЛ', 'ИННЮЛ') || getAttr(notif, 'СвНП', 'ИННФЛ') || '';

  const uvItems = findAll(notif, 'УвИсчСумНалог');
  for (const u of uvItems) {
    const a = u.$ ?? {};
    records.push({
      inn,
      kpp: (a.КППДекл || '').trim(),
      oktmo: (a.ОКТМО || '').trim(),
      period: (a.Период || '').trim(),
      year: (a.Год || '').trim(),
      kbk: (a.КБК || '').trim(),
      slot: (a.НомерМесКварт || '').trim(),
      sum: parseInt(a.СумНалогАванс || '0', 10),
    });
  }
  return records;
}

async function parseXmlFile(file: File): Promise<any> {
  const buf = Buffer.from(await file.arrayBuffer());
  const xml = iconv.decode(buf, 'win1251');
  return xml2js.parseStringPromise(xml);
}

function mergePrev160(
  target: Record<string, number>,
  source: Record<string, number>,
): Record<string, number> {
  const merged = { ...target };
  for (const [kbk, sum] of Object.entries(source)) {
    merged[kbk] = (merged[kbk] ?? 0) + sum;
  }
  return merged;
}

function collectPrevSumNalUderzhForReport(
  reportMeta: ReportMeta,
  prevReports: { meta: ReportMeta; sumNalUderzhByKbk: Record<string, number> }[],
): Record<string, number> {
  let result: Record<string, number> = {};

  for (const prev of prevReports) {
    if (previousPeriodReportMatches(reportMeta, prev.meta)) {
      result = mergePrev160(result, prev.sumNalUderzhByKbk);
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const reportFiles = formData.getAll('reports') as File[];
    const notifFiles = formData.getAll('notifications') as File[];
    const prevFiles = formData.getAll('prevReports') as File[];
    const excluded = parseExcludedFields(formData.get('excludeMatch') as string | null);

    console.log('Файлов получено сервером:', reportFiles.length);

    if (reportFiles.length === 0) throw new Error('Отчёты не выбраны');

    const allNotifRecords: NotifRecord[] = [];
    for (const f of notifFiles) {
      try {
        const parsed = await parseXmlFile(f);
        allNotifRecords.push(...extractNotifRecords(parsed));
      } catch (e) {
        console.error(`Ошибка в уведомлении ${f.name}:`, e);
      }
    }

    const prevReports: { meta: ReportMeta; sumNalUderzhByKbk: Record<string, number> }[] = [];
    for (const f of prevFiles) {
      try {
        const parsed = await parseXmlFile(f);
        prevReports.push({
          meta: extractReportMeta(parsed),
          sumNalUderzhByKbk: extractPrevSumNalUderzhByKbk(parsed),
        });
      } catch (e) {
        console.error(`Ошибка в отчёте прошлого периода ${f.name}:`, e);
      }
    }

    const resultFiles: { name: string; data?: string; error?: string }[] = [];

    for (const reportFile of reportFiles) {
      try {
        const parsed = await parseXmlFile(reportFile);
        const reportMeta = extractReportMeta(parsed);

        const fromNotif: Record<string, Record<string, number>> = {};

        for (const rec of allNotifRecords) {
          if (
            notificationMatchesReport(rec, reportMeta, excluded) &&
            rec.kbk &&
            rec.slot
          ) {
            if (!fromNotif[rec.kbk]) fromNotif[rec.kbk] = {};
            fromNotif[rec.kbk][rec.slot] = (fromNotif[rec.kbk][rec.slot] ?? 0) + rec.sum;
          }
        }

        const hasPrevPeriod = prevReports.length > 0;
        const prevSumNalUderzhByKbk = hasPrevPeriod
          ? collectPrevSumNalUderzhForReport(reportMeta, prevReports)
          : {};

        updateReport(parsed, fromNotif, prevSumNalUderzhByKbk, hasPrevPeriod);

        const builder = new xml2js.Builder({
          xmldec: { version: '1.0', encoding: 'windows-1251' },
          renderOpts: { pretty: true, indent: '\t' },
        });

        const finalXml = builder.buildObject(parsed);

        if (global.gc) global.gc();

        resultFiles.push({
          name: reportFile.name,
          data: iconv.encode(finalXml, 'win1251').toString('base64'),
        });
      } catch (err: any) {
        console.error(`Ошибка при обработке отчёта ${reportFile.name}:`, err);
        resultFiles.push({
          name: reportFile.name,
          error: err.message || 'Неизвестная ошибка при обработке XML',
        });
      }
    }

    return new Response(JSON.stringify({ files: resultFiles }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
