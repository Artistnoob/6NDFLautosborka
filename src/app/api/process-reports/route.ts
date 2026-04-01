import { NextRequest } from 'next/server';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import { updateReport } from '@/lib/xmlProcessor';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const reports = formData.getAll('reports') as File[];
    const notifications = formData.getAll('notifications') as File[];

    if (reports.length === 0) throw new Error('Отчёт не выбран');

    // 1. Парсим все уведомления в массив объектов
    const parsedNotifs: any[] = [];
    for (const f of notifications) {
      const buf = Buffer.from(await f.arrayBuffer());
      const xml = iconv.decode(buf, 'win1251');
      const parsed = await xml2js.parseStringPromise(xml);
      parsedNotifs.push(parsed);
    }

    // 2. Обрабатываем каждый отчёт отдельно
    const resultFiles: { name: string; data: string }[] = [];

    for (const reportFile of reports) {
      const reportBuf = Buffer.from(await reportFile.arrayBuffer());
      const reportXml = iconv.decode(reportBuf, 'win1251');
      const parsedReport = await xml2js.parseStringPromise(reportXml);

      // Получаем реквизиты этого отчёта для фильтрации уведомлений
      const npNode = parsedReport?.Файл?.Документ?.[0]?.['НаимОрг']?.[0]
                  ?? parsedReport?.Файл?.['СвНП']?.[0]?.['НПЮЛ']?.[0];

      const docNode = parsedReport?.Файл?.Документ?.[0];
      const svnpNode = parsedReport?.Файл?.['СвНП']?.[0];

      const inn    = npNode?.$?.ИННЮЛ;
      const kpp    = npNode?.$?.КПП;
      const oktmo  = svnpNode?.$?.ОКТМО;
      const period = docNode?.$?.Период;
      const year   = docNode?.$?.ОтчетГод;

      // 3. Собираем fromNotif только из уведомлений с совпадающими реквизитами
      const fromNotif: Record<string, Record<string, number>> = {};

      for (const notif of parsedNotifs) {
        // Проверяем ИНН организации в уведомлении
        const notifNp = notif?.Файл?.['СвНП']?.[0]?.['НПЮЛ']?.[0]
                     ?? notif?.Файл?.Документ?.[0]?.['НПЮЛ']?.[0];
        if (inn && notifNp?.$?.ИННЮЛ !== inn) continue;

        // Ищем подходящие строки УвИсчСумНалог по всей структуре
        const items = findAll(notif, 'УвИсчСумНалог');
        for (const item of items) {
          const attrs = item.$ ?? {};

          // Фильтруем по реквизитам отчёта (если удалось их извлечь)
          if (kpp    && attrs.КППДекл !== kpp)    continue;
          if (oktmo  && attrs.ОКТМО   !== oktmo)  continue;
          if (period && attrs.Период  !== period) continue;
          if (year   && attrs.Год     !== year)   continue;

          const kbk  = attrs.КБК;
          const slot = attrs.НомерМесКварт;
          const sum  = parseInt(attrs.СумНалогАванс || '0', 10);

          if (!kbk || !slot) continue;

          if (!fromNotif[kbk]) fromNotif[kbk] = {};
          fromNotif[kbk][slot] = (fromNotif[kbk][slot] || 0) + sum;
        }
      }

      // 4. Обновляем отчёт
      updateReport(parsedReport, fromNotif);

      // 5. Сериализуем обратно в XML → Buffer → base64
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'windows-1251' },
        renderOpts: { pretty: true, indent: '\t' },
      });
      const xmlString = builder.buildObject(parsedReport);
      const finalBuffer = iconv.encode(xmlString, 'win1251');

      resultFiles.push({
        name: reportFile.name,
        data: finalBuffer.toString('base64'),
      });
    }

    // 6. Возвращаем JSON-массив всех обработанных файлов
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

// Рекурсивный поиск элементов по ключу в распарсенном xml2js-объекте
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
