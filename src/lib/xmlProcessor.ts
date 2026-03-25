// Маппинги слотов уведомлений → атрибуты XML
export const SLOT_TO_SEC1: Record<string, string> = {
  '01': 'СумНал1Срок',
  '11': 'СумНал2Срок',
  '02': 'СумНал3Срок',
  '12': 'СумНал4Срок',
  '03': 'СумНал5Срок',
  '13': 'СумНал6Срок',
};

export const SLOT_TO_SEC2: Record<string, string> = {
  '01': 'СумНалУдерж1Мес',
  '11': 'СумНалУдерж23_1Мес',
  '02': 'СумНалУдерж2Мес',
  '12': 'СумНалУдерж23_2Мес',
  '03': 'СумНалУдерж3Мес',
  '13': 'СумНалУдерж23_3Мес',
};

const parseNum = (v: any): number => {
  const n = parseFloat(String(v || '0').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Рекурсивный поиск элементов
function findAll(obj: any, key: string): any[] {
  let results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;

  if (obj[key]) {
    results = results.concat(Array.isArray(obj[key]) ? obj[key] : [obj[key]]);
  }

  for (const k in obj) {
    if (typeof obj[k] === 'object' && k !== '$' && k !== key) {
      results = results.concat(findAll(obj[k], key));
    }
  }
  return results;
}

export function updateReport(parsed: any, fromNotif: Record<string, Record<string, number>>) {
  // --- Раздел 1: ОбязНА ---
  const obiazNA = findAll(parsed, 'ОбязНА');
  for (const ob of obiazNA) {
    if (!ob.$) ob.$ = {};
    const kbk = ob.$.КБК || '';
    const sved = ob.СведСумНалУд?.[0];
    if (sved) {
      if (!sved.$) sved.$ = {};

      let total160 = 0;
      for (const [slot, attr] of Object.entries(SLOT_TO_SEC1)) {
        const val = fromNotif[kbk]?.[slot] || 0;
        sved.$[attr] = String(Math.round(val));
        total160 += Math.round(val);
      }
      ob.$.СумНалУд = String(total160);
    }
  }

  // --- Раздел 2: РасчСумНал ---
  const raschs = findAll(parsed, 'РасчСумНал');
  for (const r of raschs) {
    if (!r.$) r.$ = {};
    const kbk = r.$.КБК || '';
    const stavka = parseNum(r.$.Ставка || '13') / 100;

    // === КРИТИЧНО: Обнуляем строки 170 и 180 ===
    r.$.СумНалНеУдерж = "0";
    r.$.СумНалИзлУдерж = "0";

    // Сброс и заполнение полей удержанного налога (021-026)
    let total160 = 0;
    for (const [slot, attr] of Object.entries(SLOT_TO_SEC2)) {
      const val = fromNotif[kbk]?.[slot] || 0;
      r.$[attr] = String(Math.round(val));
      total160 += Math.round(val);
    }

    // Расчет зависимых полей
    const sum140 = total160;
    const sum131 = stavka > 0
      ? Math.round((sum140 / stavka) * 100) / 100
      : 0;

    const sum130 = parseNum(r.$.СумВыч || '0');
    const sum120 = Math.round((sum131 + sum130) * 100) / 100;

    r.$.СумНалУдерж = String(total160);
    r.$.СумНалИсч = String(sum140);
    r.$.НалБаза = sum131.toFixed(2);
    r.$.СумНачислНач = sum120.toFixed(2);

    // Дополнительно можно удалить старые атрибуты полностью (рекомендуется)
    // delete r.$['СумНалНеУдерж'];   // если хочешь полностью убрать атрибут
    // delete r.$['СумНалИзлУдерж'];
  }
}