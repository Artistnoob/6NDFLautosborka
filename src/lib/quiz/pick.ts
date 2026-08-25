import type { QuizQuestion, QuizSectionId } from './types'
import { QUIZ_LENGTH } from './types'

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function shuffleQuestion(question: QuizQuestion): QuizQuestion {
  const order = shuffle([0, 1, 2, 3]) as Array<0 | 1 | 2 | 3>
  return {
    ...question,
    options: [
      question.options[order[0]],
      question.options[order[1]],
      question.options[order[2]],
      question.options[order[3]],
    ],
    correct: order.indexOf(question.correct) as 0 | 1 | 2 | 3,
  }
}

export function pickQuestions(
  bank: QuizQuestion[],
  sectionIds: QuizSectionId[],
  usedIds: string[],
): { questions: QuizQuestion[]; nextUsedIds: string[] } {
  const selected = new Set(sectionIds)
  const pool = bank.filter(item => selected.has(item.section))
  const unused = pool.filter(item => !usedIds.includes(item.id))
  const source = unused.length >= QUIZ_LENGTH || unused.length === pool.length
    ? unused
    : pool
  const picked = shuffle(source).slice(0, Math.min(QUIZ_LENGTH, source.length))
  const pickedIds = new Set(picked.map(item => item.id))
  const stale = unused.length >= QUIZ_LENGTH ? usedIds : usedIds.filter(id => !pool.some(item => item.id === id))
  return {
    questions: picked.map(shuffleQuestion),
    nextUsedIds: [...stale.filter(id => !pickedIds.has(id)), ...picked.map(item => item.id)],
  }
}
