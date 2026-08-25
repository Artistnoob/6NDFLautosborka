import { QUIZ_BANK as PART1 } from './bankPart1'
import { QUIZ_BANK_PART2 } from './bankPart2'
import type { QuizQuestion } from './types'

export const QUIZ_BANK: QuizQuestion[] = [...PART1, ...QUIZ_BANK_PART2]
