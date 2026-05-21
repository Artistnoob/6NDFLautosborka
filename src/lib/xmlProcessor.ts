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

function sumNotifByKbk(fromNotif: Record<string, Record<string, number>>, kbk: string): number {
  const slots = fromNotif[kbk];
  if (!slots) return 0;
  return Object.values(slots).reduce((acc, v) => acc + Math.round(v), 0);
}

export function updateReport(
  parsed: any,
  fromNotif: Record<string, Record<string, number>>,
  prevSumNalUderzhByKbk: Record<string, number> = {},
  usePrevPeriod = false,
) {
  // --- Раздел 1: ОбязНА ---
  const obiazNA = findAll(parsed, 'ОбязНА');
  for (const ob of obiazNA) {
    if (!ob.$) ob.$ = {};
    const kbk = ob.$.КБК || '';
    const sved = ob.СведСумНалУд?.[0];
    if (sved) {
      if (!sved.$) sved.$ = {};

      for (const [slot, attr] of Object.entries(SLOT_TO_SEC1)) {
        const val = fromNotif[kbk]?.[slot] || 0;
        sved.$[attr] = String(Math.round(val));
      }

      const notifTotal = sumNotifByKbk(fromNotif, kbk);
      const combinedTotal = usePrevPeriod
        ? notifTotal + Math.round(prevSumNalUderzhByKbk[kbk] || 0)
        : notifTotal;
      ob.$.СумНалУд = String(combinedTotal);
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

    // Сброс и заполнение полей удержанного налога (021-026) — только из уведомлений
    for (const [slot, attr] of Object.entries(SLOT_TO_SEC2)) {
      const val = fromNotif[kbk]?.[slot] || 0;
      r.$[attr] = String(Math.round(val));
    }

    const notifTotal = sumNotifByKbk(fromNotif, kbk);
    const combinedTotal = usePrevPeriod
      ? notifTotal + Math.round(prevSumNalUderzhByKbk[kbk] || 0)
      : notifTotal;

    // Расчет зависимых полей от итога (уведомления + прошлый период)
    const sum140 = combinedTotal;
    const sum131 = stavka > 0
      ? Math.round((sum140 / stavka) * 100) / 100
      : 0;

    const sum130 = parseNum(r.$.СумВыч || '0');
    const sum120 = Math.round((sum131 + sum130) * 100) / 100;

    r.$.СумНалУдерж = String(combinedTotal);
    r.$.СумНалИсч = String(sum140);
    r.$.НалБаза = sum131.toFixed(2);
    r.$.СумНачислНач = sum120.toFixed(2);

    // Дополнительно можно удалить старые атрибуты полностью (рекомендуется)
    // delete r.$['СумНалНеУдерж'];   // если хочешь полностью убрать атрибут
    // delete r.$['СумНалИзлУдерж'];
  }
}