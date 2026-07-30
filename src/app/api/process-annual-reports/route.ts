import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import JSZip from 'jszip';
import { processAnnualReportsBatch } from '@/lib/annualProcessor';
import {
  extractReportMeta,
  parseExcludedFields,
  type NotifRecord,
  type ReportMeta,
} from '@/lib/matching';
import { findAll } from '@/lib/xmlUtils';

export const maxDuration = 300;

interface XmlInput {
  name: string;
  data: Buffer;
}

interface ZipManifestEntry {
  name: string;
  path: string;
}

interface AnnualZipManifest {
  reports: ZipManifestEntry[];
  notifications: ZipManifestEntry[];
  prevReports: ZipManifestEntry[];
  excludeMatch: MatchField[];
  taxOverrides: Record<string, number>;
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

async function parseXmlInput(input: XmlInput): Promise<any> {
  const xml = iconv.decode(input.data, 'win1251');
  return xml2js.parseStringPromise(xml);
}

async function fileToInput(file: File): Promise<XmlInput> {
  return {
    name: file.name,
    data: Buffer.from(await file.arrayBuffer()),
  };
}

async function readZipInputs(
  zip: JSZip,
  entries: ZipManifestEntry[],
): Promise<XmlInput[]> {
  const result: XmlInput[] = [];
  for (const entry of entries) {
    const zippedFile = zip.file(entry.path);
    if (!zippedFile) throw new Error(`В архиве отсутствует файл ${entry.name}`);
    result.push({
      name: entry.name,
      data: await zippedFile.async('nodebuffer'),
    });
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const isZipRequest = req.headers.get('content-type')?.includes('application/zip') ?? false;
    let reportFiles: XmlInput[];
    let notifFiles: XmlInput[];
    let prevFiles: XmlInput[];
    let excluded: Set<MatchField>;
    let taxOverrides: Record<string, number>;

    if (isZipRequest) {
      const zip = await JSZip.loadAsync(Buffer.from(await req.arrayBuffer()));
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) throw new Error('В архиве отсутствует manifest.json');
      const manifest = JSON.parse(
        await manifestFile.async('string'),
      ) as AnnualZipManifest;

      reportFiles = await readZipInputs(zip, manifest.reports ?? []);
      notifFiles = await readZipInputs(zip, manifest.notifications ?? []);
      prevFiles = await readZipInputs(zip, manifest.prevReports ?? []);
      excluded = parseExcludedFields(JSON.stringify(manifest.excludeMatch ?? []));
      taxOverrides = parseTaxOverrides(JSON.stringify(manifest.taxOverrides ?? {}));
    } else {
      const formData = await req.formData();
      reportFiles = await Promise.all(
        (formData.getAll('reports') as File[]).map(fileToInput),
      );
      notifFiles = await Promise.all(
        (formData.getAll('notifications') as File[]).map(fileToInput),
      );
      prevFiles = await Promise.all(
        (formData.getAll('prevReports') as File[]).map(fileToInput),
      );
      excluded = parseExcludedFields(formData.get('excludeMatch') as string | null);
      taxOverrides = parseTaxOverrides(formData.get('taxOverrides'));
    }

    if (reportFiles.length === 0) throw new Error('Годовые отчёты не выбраны');

    const allNotifRecords: NotifRecord[] = [];
    for (const f of notifFiles) {
      try {
        const parsed = await parseXmlInput(f);
        allNotifRecords.push(...extractNotifRecords(parsed));
      } catch (e) {
        console.error(`Ошибка в уведомлении ${f.name}:`, e);
      }
    }

    const prevReports: { meta: ReportMeta; sumNalUderzhByKbk: Record<string, number> }[] = [];
    for (const f of prevFiles) {
      try {
        const parsed = await parseXmlInput(f);
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
      const parsed = await parseXmlInput(reportFile);
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
    const outputZip = isZipRequest ? new JSZip() : null;

    for (let i = 0; i < parsedReports.length; i++) {
      try {
        const finalXml = builder.buildObject(parsedReports[i]);
        const encoded = iconv.encode(finalXml, 'win1251');
        if (outputZip) {
          outputZip.file(reportNames[i], encoded);
        } else {
          resultFiles.push({
            name: reportNames[i],
            data: encoded.toString('base64'),
          });
        }
      } catch (err: any) {
        resultFiles.push({
          name: reportNames[i],
          error: err.message || 'Неизвестная ошибка при обработке XML',
        });
      }
    }

    if (outputZip) {
      if (resultFiles.length > 0) {
        outputZip.file('errors.json', JSON.stringify(resultFiles, null, 2));
      }
      const zipBuffer = await outputZip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      return new Response(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="annual-reports.zip"',
        },
      });
    }

    return new Response(JSON.stringify({ files: resultFiles }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
