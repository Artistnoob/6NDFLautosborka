'use client'

import { useMemo, useState } from 'react'
import { ScrollText, X } from 'lucide-react'
import { QUIZ_BANK } from '@/lib/quiz/bank'
import { pickQuestions } from '@/lib/quiz/pick'
import {
  EDDIE_PER_CORRECT,
  QUIZ_LENGTH,
  QUIZ_SECTIONS,
  type QuizQuestion,
  type QuizSectionId,
} from '@/lib/quiz/types'

const USED_KEY = 'cyber-quiz-used'

type Phase = 'pick' | 'quiz' | 'result'

function readUsedIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USED_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

export default function NightCityContracts({
  disabled = false,
  onAward,
  onBusyChange,
}: {
  disabled?: boolean
  onAward: (eddies: number) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('pick')
  const [selected, setSelected] = useState<QuizSectionId[]>(() => QUIZ_SECTIONS.map(item => item.id))
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const current = questions[index]
  const awarded = correctCount * EDDIE_PER_CORRECT
  const availableCount = useMemo(
    () => QUIZ_BANK.filter(item => selected.includes(item.section)).length,
    [selected],
  )

  const close = () => {
    setOpen(false)
    setPhase('pick')
    setQuestions([])
    setIndex(0)
    setChoice(null)
    setCorrectCount(0)
    onBusyChange?.(false)
  }

  const toggleSection = (id: QuizSectionId) => {
    setSelected(currentIds => (
      currentIds.includes(id)
        ? currentIds.filter(item => item !== id)
        : [...currentIds, id]
    ))
  }

  const startQuiz = () => {
    if (selected.length === 0 || availableCount === 0) return
    const picked = pickQuestions(QUIZ_BANK, selected, readUsedIds())
    if (picked.questions.length === 0) return
    setQuestions(picked.questions)
    setIndex(0)
    setChoice(null)
    setCorrectCount(0)
    setPhase('quiz')
  }

  const answer = (optionIndex: number) => {
    if (choice !== null || !current) return
    setChoice(optionIndex)
    if (optionIndex === current.correct) setCorrectCount(count => count + 1)
  }

  const next = () => {
    if (choice === null) return
    if (index + 1 < questions.length) {
      setIndex(index + 1)
      setChoice(null)
      return
    }
    const used = new Set(readUsedIds())
    for (const item of questions) used.add(item.id)
    localStorage.setItem(USED_KEY, JSON.stringify([...used]))
    const eddies = correctCount * EDDIE_PER_CORRECT
    if (eddies > 0) onAward(eddies)
    setPhase('result')
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true)
          setPhase('pick')
          onBusyChange?.(true)
        }}
        className="cyber-btn-hot inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold disabled:opacity-40"
      >
        <ScrollText className="h-4 w-4" /> КОНТРАКТЫ НАЙТ-СИТИ
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <section className="cyber-panel flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col border">
            <div className="cyber-banner flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2 font-black italic tracking-widest">
                <ScrollText className="h-5 w-5" />
                {phase === 'pick' && 'КОНТРАКТЫ НАЙТ-СИТИ'}
                {phase === 'quiz' && `КОНТРАКТ // ${index + 1} / ${questions.length}`}
                {phase === 'result' && 'КОНТРАКТ ЗАКРЫТ'}
              </div>
              <button type="button" onClick={close} className="cyber-muted hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {phase === 'pick' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <p className="cyber-text mb-4 text-sm leading-relaxed">
                  Выберите разделы учёта ЗГУ. Контракт — {QUIZ_LENGTH} вопросов, за каждый верный ответ начисляется {EDDIE_PER_CORRECT} эдди на крутки Afterlife.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(QUIZ_SECTIONS.map(item => item.id))}
                    className="cyber-btn-line border px-2.5 py-1 text-[10px] font-bold"
                  >
                    ВСЕ РАЗДЕЛЫ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="cyber-btn-line border px-2.5 py-1 text-[10px] font-bold"
                  >
                    СБРОСИТЬ
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {QUIZ_SECTIONS.map(section => {
                    const on = selected.includes(section.id)
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className={`border px-3 py-2 text-left ${on ? 'cyber-btn-accent' : 'cyber-btn-line'}`}
                      >
                        <div className="text-xs font-black tracking-wide">{section.title}</div>
                        <div className="cyber-muted mt-1 text-[10px]">{section.blurb}</div>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="cyber-muted text-[11px]">
                    В выбранных разделах вопросов: {availableCount}
                  </div>
                  <button
                    type="button"
                    disabled={selected.length === 0 || availableCount === 0}
                    onClick={startQuiz}
                    className="cyber-btn-accent border px-5 py-2 text-xs font-black tracking-widest disabled:opacity-40"
                  >
                    ПРИНЯТЬ КОНТРАКТ
                  </button>
                </div>
              </div>
            )}

            {phase === 'quiz' && current && (
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="cyber-muted mb-2 text-[10px] tracking-widest">
                  {QUIZ_SECTIONS.find(item => item.id === current.section)?.title}
                </div>
                <p className="cyber-text mb-4 text-sm font-bold leading-relaxed">{current.question}</p>
                <div className="grid gap-2">
                  {current.options.map((option, optionIndex) => {
                    const revealed = choice !== null
                    const isCorrect = optionIndex === current.correct
                    const isWrongPick = revealed && optionIndex === choice && !isCorrect
                    return (
                      <button
                        key={`${current.id}-${optionIndex}`}
                        type="button"
                        disabled={revealed}
                        onClick={() => answer(optionIndex)}
                        className={`border px-3 py-2.5 text-left text-sm ${
                          revealed && isCorrect
                            ? 'cyber-quiz-correct'
                            : isWrongPick
                              ? 'cyber-quiz-wrong'
                              : 'cyber-btn-line'
                        }`}
                      >
                        <span className="mr-2 font-mono text-[11px] opacity-70">{['A', 'B', 'C', 'D'][optionIndex]}</span>
                        {option}
                      </button>
                    )
                  })}
                </div>
                {choice !== null && (
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={next}
                      className="cyber-btn-accent border px-5 py-2 text-xs font-black tracking-widest"
                    >
                      {index + 1 < questions.length ? 'ДАЛЕЕ' : 'ЗАВЕРШИТЬ'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === 'result' && (
              <div className="p-5">
                <div className="cyber-text text-sm leading-relaxed">
                  Верных ответов: <span className="cyber-number font-black">{correctCount}</span> из {questions.length}.
                </div>
                <div className="cyber-number mt-3 text-3xl font-black">+{awarded} ЭДДИ</div>
                <p className="cyber-muted mt-2 text-xs">
                  {awarded > 0
                    ? 'Эдди зачислены на счёт Afterlife и доступны для круток.'
                    : 'В этот раз эдди не начислены. Можно взять новый контракт.'}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('pick')}
                    className="cyber-btn-line border px-4 py-2 text-xs font-bold"
                  >
                    ЕЩЁ КОНТРАКТ
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="cyber-btn-accent border px-4 py-2 text-xs font-black"
                  >
                    В AFTERLIFE
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
