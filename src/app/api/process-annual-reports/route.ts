import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { processAnnualReportsBatch } from '@/lib/annualProcessor';
import {
  extractReportMeta,
  parseExcludedFields,
  type NotifRecord,
  type ReportMeta,
} from '@/lib/matching';
import { findAll } from '@/lib/xmlUtils';

export const maxDuration = 300;

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

function parseNum(value: unknown): number {
  const parsed = parseFloat(String(value ?? '0').replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseTaxOverrides(raw: FormDataEntryValue | null): Record<string, number> {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: Record<string, number> = {};
    for (const [personKey, value] of Object.entries(parsed)) {
      const amount = Number(value);
      if (personKey && Number.isFinite(amount) && amount >= 0) {
        result[personKey] = Math.round(amount);
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Строка 160 прошлого квартала по КБК только для годовой сборки. */
function extractAnnualPrevSumNalUderzhByKbk(parsed: any): Record<string, number> {
  const byKbk: Record<string, number> = {};

  for (const section of findAll(parsed, 'РасчСумНал')) {
    const kbk = (section.$?.КБК ?? '').trim();
    if (!kbk) continue;
    byKbk[kbk] =
      (byKbk[kbk] ?? 0) + Math.round(parseNum(section.$?.СумНалУдерж));
  }

  return byKbk;
}

async function parseXmlFile(file: File): Promise<any> {
  const buf = Buffer.from(await file.arrayBuffer());
  const xml = iconv.decode(buf, 'win1251');
  return xml2js.parseStringPromise(xml);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const reportFiles = formData.getAll('reports') as File[];
    const notifFiles = formData.getAll('notifications') as File[];
    const prevFiles = formData.getAll('prevReports') as File[];
    const excluded = parseExcludedFields(formData.get('excludeMatch') as string | null);
    const taxOverrides = parseTaxOverrides(formData.get('taxOverrides'));

    if (reportFiles.length === 0) throw new Error('Годовые отчёты не выбраны');

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
          sumNalUderzhByKbk: extractAnnualPrevSumNalUderzhByKbk(parsed),
        });
      } catch (e) {
        console.error(`Ошибка в отчёте прошлого периода ${f.name}:`, e);
      }
    }

    const parsedReports: any[] = [];
    const reportMetas: ReportMeta[] = [];
    const reportNames: string[] = [];

    for (const reportFile of reportFiles) {
      const parsed = await parseXmlFile(reportFile);
      parsedReports.push(parsed);
      reportMetas.push(extractReportMeta(parsed));
      reportNames.push(reportFile.name);
    }

    const issues = processAnnualReportsBatch({
      parsedReports,
      reportMetas,
      allNotifRecords,
      prevReports,
      excluded,
      taxOverrides,
    });

    if (issues.length > 0) {
      return new Response(JSON.stringify({
        error: `Не удалось распределить налог у ${issues.length} сотрудник(ов)`,
        issues,
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'windows-1251' },
      renderOpts: { pretty: true, indent: '\t' },
    });

    const resultFiles: { name: string; data?: string; error?: string }[] = [];

    for (let i = 0; i < parsedReports.length; i++) {
      try {
        const finalXml = builder.buildObject(parsedReports[i]);
        resultFiles.push({
          name: reportNames[i],
          data: iconv.encode(finalXml, 'win1251').toString('base64'),
        });
      } catch (err: any) {
        resultFiles.push({
          name: reportNames[i],
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
