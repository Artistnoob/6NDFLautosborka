import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { updateReport } from '@/lib/xmlProcessor';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const reports = formData.getAll('reports') as File[];
    const notifications = formData.getAll('notifications') as File[];

    if (reports.length === 0) throw new Error('Отчет не выбран');

    // 1. Сбор данных из уведомлений
    const fromNotif: Record<string, Record<string, number>> = {};
    for (const f of notifications) {
      const buf = Buffer.from(await f.arrayBuffer());
      const xml = iconv.decode(buf, 'win1251');
      const parsed = await xml2js.parseStringPromise(xml);

      const items = parsed.Файл?.Документ?.[0]?.УвИсчСумНалог || [];
      for (const item of items) {
        const kbk = item.$.КБК;
        const slot = item.$.НомерМесКварт;
        const sum = parseFloat(item.$.СумНалогАванс || '0');
        if (!fromNotif[kbk]) fromNotif[kbk] = {};
        fromNotif[kbk][slot] = (fromNotif[kbk][slot] || 0) + sum;
      }
    }

    // 2. Обработка первого отчета (для примера)
    const reportFile = reports[0];
    const reportBuf = Buffer.from(await reportFile.arrayBuffer());
    const reportXml = iconv.decode(reportBuf, 'win1251');
    const parsedReport = await xml2js.parseStringPromise(reportXml);

    updateReport(parsedReport, fromNotif);

    // 3. Сборка обратно в Buffer с кодировкой 1251
    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'windows-1251' },
      renderOpts: { pretty: true, indent: '\t' }
    });
    const xmlString = builder.buildObject(parsedReport);
    const finalBuffer = iconv.encode(xmlString, 'win1251');

    // Самый стабильный способ в Next.js 15.2+
return new Response(finalBuffer.buffer as ArrayBuffer, {
  headers: {
    'Content-Type': 'application/xml',
    'Content-Disposition': `attachment; filename="${reportFile.name}"`,
  },
});

  } catch (err: any) {
    console.error(err);
    // Только в случае ошибки возвращаем JSON, чтобы клиент мог его отобразить
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}