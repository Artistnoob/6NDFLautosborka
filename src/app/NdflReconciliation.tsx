'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Scale, Users, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import {
  compareReconciliation,
  type ReconciliationDimension,
  type ReconciliationMetric,
  type ReconciliationResult,
} from '@/lib/reconciliation'

const EXCESS_RATES = [15, 18, 20, 22] as const

interface ResultSection {
  title: string
  result: ReconciliationResult
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function PasteField({
  title,
  value,
  onChange,
  hint,
  compact = false,
}: {
  title: string
  value: string
  onChange: (value: string) => void
  hint: string
  compact?: boolean
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#e8e9f0]">{title}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={hint}
        className={`${compact ? 'min-h-32' : 'min-h-72'} w-full resize-y rounded-xl border border-reconciliation-border-hi bg-reconciliation-bg px-4 py-3 font-mono text-xs leading-relaxed text-[#e8e9f0] outline-none transition-colors placeholder:text-muted/60 focus:border-reconciliation-accent`}
      />
    </label>
  )
}

export default function NdflReconciliation() {
  const [metric, setMetric] = useState<ReconciliationMetric>('income')
  const [dimension, setDimension] = useState<ReconciliationDimension>('employee')
  const [salaryText, setSalaryText] = useState('')
  const [ndflText, setNdflText] = useState('')
  const [hasExcess, setHasExcess] = useState(false)
  const [excessTexts, setExcessTexts] = useState<Record<number, { salary: string; ndfl: string }>>(
    () => Object.fromEntries(EXCESS_RATES.map(rate => [rate, { salary: '', ndfl: '' }])),
  )
  const [results, setResults] = useState<ResultSection[]>([])

  const keyLabel = dimension === 'employee' ? 'сотрудникам' : 'регистраторам'
  const ndflColumn = metric === 'income' ? 'Начислено' : 'Исчислено до превыш'
  const hasExcessInput = EXCESS_RATES.some(rate =>
    excessTexts[rate].salary.trim().length > 0 || excessTexts[rate].ndfl.trim().length > 0,
  )
  const hasInput =
    salaryText.trim().length > 0 ||
    ndflText.trim().length > 0 ||
    (metric === 'tax' && hasExcess && hasExcessInput)
  const totalDifferences = useMemo(
    () => results.reduce((sum, section) => sum + section.result.rows.length, 0),
    [results],
  )

  const changeMetric = (next: ReconciliationMetric) => {
    setMetric(next)
    if (next === 'income') setHasExcess(false)
    setResults([])
  }

  const updateExcess = (rate: number, side: 'salary' | 'ndfl', value: string) => {
    setExcessTexts(prev => ({
      ...prev,
      [rate]: { ...prev[rate], [side]: value },
    }))
  }

  const compare = () => {
    const next: ResultSection[] = [{
      title: metric === 'income' ? 'Доход' : 'Налог до превышения',
      result: compareReconciliation({
        salaryText,
        ndflText,
        metric,
        dimension,
      }),
    }]

    if (metric === 'tax' && hasExcess) {
      for (const rate of EXCESS_RATES) {
        const texts = excessTexts[rate]
        if (!texts.salary.trim() && !texts.ndfl.trim()) continue
        next.push({
          title: `Налог с превышения ${rate}%`,
          result: compareReconciliation({
            salaryText: texts.salary,
            ndflText: texts.ndfl,
            metric: 'tax',
            dimension,
            ndflAmountHeader: `Исчислено с пр ${rate}%`,
          }),
        })
      }
    }

    setResults(next)
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-reconciliation-accent/15 text-reconciliation-accent flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Сверка НДФЛ</h1>
            <p className="text-sm text-muted mt-1">Сравнение данных анализа зарплаты и анализа НДФЛ</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-reconciliation-border bg-reconciliation-surface p-5 mb-5">
        <div className="text-sm font-semibold mb-3">Что сравниваем</div>
        <div className="flex flex-wrap gap-3">
          {([
            ['income', 'Сравнить доход'],
            ['tax', 'Сравнить налог'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => changeMetric(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                metric === value
                  ? 'bg-reconciliation-accent text-[#102713] shadow-lg shadow-reconciliation-accent/20'
                  : 'bg-reconciliation-border text-muted hover:bg-reconciliation-border-hi hover:text-[#e8e9f0]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-reconciliation-border bg-reconciliation-surface p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="font-semibold">Сравнение по {keyLabel}</div>
            <div className="text-xs text-muted mt-1">
              В анализе НДФЛ используется колонка «{ndflColumn}»
            </div>
          </div>
          <button
            onClick={() => {
              setDimension(current => current === 'employee' ? 'registrar' : 'employee')
              setResults([])
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-reconciliation-border px-4 py-2 text-sm text-[#e8e9f0] hover:bg-reconciliation-border-hi transition-colors"
          >
            {dimension === 'employee'
              ? <FileSpreadsheet className="w-4 h-4" />
              : <Users className="w-4 h-4" />}
            {dimension === 'employee' ? 'Сравнить по регистратору' : 'Сравнить по сотрудникам'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PasteField
            title="Анализ зарплаты"
            value={salaryText}
            onChange={value => { setSalaryText(value); setResults([]) }}
            hint={dimension === 'employee'
              ? 'Вставьте таблицу с сотрудниками и суммами'
              : 'Вставьте таблицу с регистраторами и суммами'}
          />
          <PasteField
            title="Анализ НДФЛ"
            value={ndflText}
            onChange={value => { setNdflText(value); setResults([]) }}
            hint={`Вставьте таблицу. Будут выбраны колонки «${dimension === 'employee' ? 'Сотрудник' : 'Регистратор'}» и «${ndflColumn}»`}
          />
        </div>
      </div>

      {metric === 'tax' && hasExcess && (
        <div className="rounded-xl border border-reconciliation-border bg-reconciliation-surface p-5 mb-5">
          <div className="font-semibold mb-1">Налог с превышения</div>
          <p className="text-xs text-muted mb-5">
            Для анализа НДФЛ используются колонки «Исчислено с пр 15%», 18%, 20% и 22%.
          </p>
          <div className="flex flex-col gap-6">
            {EXCESS_RATES.map(rate => (
              <div key={rate}>
                <div className="text-sm font-medium text-reconciliation-accent mb-3">Ставка {rate}%</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <PasteField
                    compact
                    title={`Анализ зарплаты — ${rate}%`}
                    value={excessTexts[rate].salary}
                    onChange={value => { updateExcess(rate, 'salary', value); setResults([]) }}
                    hint="Вставьте сотрудников или документы и суммы"
                  />
                  <PasteField
                    compact
                    title={`Анализ НДФЛ — ${rate}%`}
                    value={excessTexts[rate].ndfl}
                    onChange={value => { updateExcess(rate, 'ndfl', value); setResults([]) }}
                    hint={`Колонка суммы: «Исчислено с пр ${rate}%»`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 mb-6">
        {metric === 'tax' && (
          <button
            onClick={() => { setHasExcess(value => !value); setResults([]) }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              hasExcess
                ? 'bg-reconciliation-accent/20 text-reconciliation-accent'
                : 'bg-reconciliation-border text-[#e8e9f0] hover:bg-reconciliation-border-hi'
            }`}
          >
            Есть превышение (15%, 18%, 20%, 22%)
          </button>
        )}
        <button
          onClick={compare}
          disabled={!hasInput}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            hasInput
              ? 'bg-reconciliation-accent text-[#102713] hover:bg-reconciliation-accent-hi hover:-translate-y-0.5 shadow-lg shadow-reconciliation-accent/20'
              : 'bg-reconciliation-border text-muted opacity-50 cursor-not-allowed'
          }`}
        >
          <Scale className="w-4 h-4" /> Сравнить
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-reconciliation-border bg-reconciliation-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-reconciliation-border flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Результат сверки</div>
              <div className="text-xs text-muted mt-1">
                Анализ зарплаты минус анализ НДФЛ
              </div>
            </div>
            {totalDifferences === 0 ? (
              <span className="inline-flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4" /> Расхождений нет
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="w-4 h-4" /> Расхождений: {totalDifferences}
              </span>
            )}
          </div>

          {results.map(section => (
            <div key={section.title} className="border-b last:border-b-0 border-reconciliation-border">
              <div className="px-5 py-3 bg-reconciliation-bg/60 font-medium text-sm">{section.title}</div>
              {section.result.warnings.map((warning, index) => (
                <div key={index} className="px-5 py-2 text-xs text-warning border-t border-reconciliation-border">
                  {warning}
                </div>
              ))}
              {section.result.rows.length === 0 ? (
                <div className="px-5 py-6 text-sm text-success">Все суммы совпадают.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted border-t border-b border-reconciliation-border">
                      <tr>
                        <th className="px-5 py-3">{dimension === 'employee' ? 'Сотрудник' : 'Документ'}</th>
                        <th className="px-4 py-3 text-right">Анализ зарплаты</th>
                        <th className="px-4 py-3 text-right">Анализ НДФЛ</th>
                        <th className="px-5 py-3 text-right">Разница</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.result.rows.map(row => (
                        <tr key={row.key} className="border-b last:border-b-0 border-reconciliation-border/70">
                          <td className="px-5 py-3">
                            <div>{row.label}</div>
                            <div className="text-[11px] text-muted mt-1">
                              {row.status === 'salary-only'
                                ? 'Отсутствует в анализе НДФЛ'
                                : row.status === 'ndfl-only'
                                  ? 'Отсутствует в анализе зарплаты'
                                  : 'Суммы различаются'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{formatAmount(row.salaryAmount)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatAmount(row.ndflAmount)}</td>
                          <td className={`px-5 py-3 text-right font-mono ${row.difference < 0 ? 'text-danger' : 'text-warning'}`}>
                            {formatAmount(row.difference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
