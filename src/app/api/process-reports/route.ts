import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { updateReport } from '@/lib/xmlProcessor';

// Увеличиваем таймаут выполнения
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

interface NotifRecord {
  inn: string; kpp: string; oktmo: string; period: string; year: string;
  kbk: string; slot: string; sum: number;
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const reportFiles = formData.getAll('reports') as File[];
    const notifFiles = formData.getAll('notifications') as File[];
    console.log('Файлов получено сервером:', reportFiles.length);

    if (reportFiles.length === 0) throw new Error('Отчёты не выбраны');

    const allNotifRecords: NotifRecord[] = [];
    for (const f of notifFiles) {
      try {
        const buf = Buffer.from(await f.arrayBuffer());
        const xml = iconv.decode(buf, 'win1251');
        const parsed = await xml2js.parseStringPromise(xml);
        allNotifRecords.push(...extractNotifRecords(parsed));
      } catch (e) {
        console.error(`Ошибка в уведомлении ${f.name}:`, e);
      }
    }

    const resultFiles: { name: string; data?: string; error?: string }[] = [];

    for (const reportFile of reportFiles) {
      try {
        const buf = Buffer.from(await reportFile.arrayBuffer());
        const xml = iconv.decode(buf, 'win1251');
        const parsed = await xml2js.parseStringPromise(xml);

        // Расширенный поиск метаданных
        const r_inn = getAttr(parsed, 'НПЮЛ', 'ИННЮЛ') || getAttr(parsed, 'СвНП', 'ИННФЛ') || '';
        const r_kpp = getAttr(parsed, 'НПЮЛ', 'КПП') || getAttr(parsed, 'СвНП', 'КПП') || '';
        const r_oktmo = getAttr(parsed, 'СвОКТМО', 'ОКТМО') || getAttr(parsed, 'СвНП', 'ОКТМО') || getAttr(parsed, 'Документ', 'ОКТМО') || '';
        const r_period = getAttr(parsed, 'Документ', 'Период') || '';
        const r_year = getAttr(parsed, 'Документ', 'ОтчетГод') || '';

        const fromNotif: Record<string, Record<string, number>> = {};

        for (const rec of allNotifRecords) {
          const isMatch =
            (!r_inn || rec.inn === r_inn) &&
            (!r_kpp || !rec.kpp || rec.kpp === r_kpp) &&
            (!r_oktmo || rec.oktmo === r_oktmo) &&
            (rec.period === r_period) &&
            (rec.year === r_year);

          if (isMatch && rec.kbk && rec.slot) {
            if (!fromNotif[rec.kbk]) fromNotif[rec.kbk] = {};
            fromNotif[rec.kbk][rec.slot] = (fromNotif[rec.kbk][rec.slot] ?? 0) + rec.sum;
          }
        }

        updateReport(parsed, fromNotif);

        const builder = new xml2js.Builder({
          xmldec: { version: '1.0', encoding: 'windows-1251' },
          renderOpts: { pretty: true, indent: '\t' },
        });

        const finalXml = builder.buildObject(parsed);

        // ←←← Принудительная сборка мусора (Node.js)
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