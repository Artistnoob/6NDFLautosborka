export type QuizSectionId =
  | 'ndfl-reports'
  | 'sick'
  | 'buh'
  | 'payments'
  | 'kadry'
  | 'ndfl'
  | 'vacation'
  | 'other'
  | 'payroll'
  | 'rsv'
  | 'szv'
  | 'stats'
  | 'deductions'

export interface QuizSection {
  id: QuizSectionId
  title: string
  blurb: string
}

export interface QuizQuestion {
  id: string
  section: QuizSectionId
  question: string
  options: [string, string, string, string]
  correct: 0 | 1 | 2 | 3
}

export const QUIZ_LENGTH = 10
export const EDDIE_PER_CORRECT = 200

export const QUIZ_SECTIONS: QuizSection[] = [
  { id: 'ndfl-reports', title: '6-НДФЛ, 2-НДФЛ', blurb: 'Отчётность, уведомления, коды сроков' },
  { id: 'sick', title: 'БЛ, электронный БЛ, пособия', blurb: 'Больничные, ЭЛН, расчёт пособий' },
  { id: 'buh', title: 'Бухучет ЗП, обмен с БГУ', blurb: 'Отражение, синхронизация, 303.01' },
  { id: 'payments', title: 'Выплаты, долги', blurb: 'Ведомости, карты МИР, взаиморасчёты' },
  { id: 'kadry', title: 'Кадры', blurb: 'Приём, перевод, табель, ГПХ' },
  { id: 'ndfl', title: 'НДФЛ', blurb: 'Исчисление, удержание, вычеты' },
  { id: 'vacation', title: 'Отпуск, средний заработок', blurb: 'Средний, резервы, рабочий год' },
  { id: 'other', title: 'Прочие вопросы по учету', blurb: 'Кабинет сотрудника, расширения' },
  { id: 'payroll', title: 'Расчет зарплаты', blurb: 'Начисление, перерасчёты, показатели' },
  { id: 'rsv', title: 'РСВ, перс. сведения, ЕФС-1 р.2', blurb: 'Взносы и раздел 2 ЕФС-1' },
  { id: 'szv', title: 'СЗВ, ЕФС-1 раздел 1', blurb: 'Мероприятия, стаж, льготные профессии' },
  { id: 'stats', title: 'Статистика (П-4, ЗП-здрав)', blurb: 'Численность, отработанное время' },
  { id: 'deductions', title: 'Удержания, взносы', blurb: 'Исполнительные, тарифы взносов' },
]
