'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { Coins, RotateCcw } from 'lucide-react'
import slotV from './slots/slot-v.png'
import slotJohnny from './slots/slot-johnny.png'
import slotJudy from './slots/slot-judy.png'
import slotPanam from './slots/slot-panam.png'
import slotJackie from './slots/slot-jackie.png'
import slotRogue from './slots/slot-rogue.png'
import slotAlt from './slots/slot-alt.png'
import slotSmasher from './slots/slot-smasher.png'
import slotTakemura from './slots/slot-takemura.png'
import slotHanako from './slots/slot-hanako.png'
import slotReed from './slots/slot-reed.png'
import slotMyers from './slots/slot-myers.png'
import slotHansen from './slots/slot-hansen.png'
import slotHands from './slots/slot-hands.png'
import slotKerry from './slots/slot-kerry.png'
import slotRiver from './slots/slot-river.png'
import slotEvelyn from './slots/slot-evelyn.png'
import slotViktor from './slots/slot-viktor.png'
import slotSongbird from './slots/slot-songbird.png'
import slotDex from './slots/slot-dex.png'
import slotYorinobu from './slots/slot-yorinobu.png'
import slotMitch from './slots/slot-mitch.png'
import slotWakako from './slots/slot-wakako.png'
import slotTbug from './slots/slot-tbug.png'

export type SlotReelCount = 3 | 5

const SYMBOL_SIZE = 112
const STRIP_LENGTH = 28
const LAND_INDEX = 24
const STARTING_EDDIES = 500
const BETS = [10, 25, 50, 100] as const
const STOP_MS_3 = [1400, 2100, 2800] as const
const STOP_MS_5 = [1100, 1500, 1900, 2300, 2800] as const

interface SlotSymbol {
  id: string
  name: string
  image: StaticImageData
  weight: number
  payout2: number
  payout3: number
  payout4: number
  payout5: number
}

const SYMBOLS_3: SlotSymbol[] = [
  { id: 'v', name: 'V', image: slotV, weight: 18, payout2: 1, payout3: 8, payout4: 20, payout5: 80 },
  { id: 'jackie', name: 'Jackie', image: slotJackie, weight: 16, payout2: 1, payout3: 10, payout4: 22, payout5: 90 },
  { id: 'judy', name: 'Judy', image: slotJudy, weight: 14, payout2: 2, payout3: 12, payout4: 24, payout5: 100 },
  { id: 'panam', name: 'Panam', image: slotPanam, weight: 12, payout2: 2, payout3: 15, payout4: 28, payout5: 110 },
  { id: 'rogue', name: 'Rogue', image: slotRogue, weight: 10, payout2: 2, payout3: 20, payout4: 35, payout5: 130 },
  { id: 'alt', name: 'Alt', image: slotAlt, weight: 8, payout2: 3, payout3: 30, payout4: 50, payout5: 180 },
  { id: 'johnny', name: 'Johnny', image: slotJohnny, weight: 6, payout2: 4, payout3: 50, payout4: 80, payout5: 250 },
  { id: 'smasher', name: 'Smasher', image: slotSmasher, weight: 4, payout2: 5, payout3: 100, payout4: 160, payout5: 400 },
]

const SYMBOLS_5: SlotSymbol[] = [
  { id: 'v', name: 'V', image: slotV, weight: 14, payout2: 1, payout3: 6, payout4: 18, payout5: 80 },
  { id: 'jackie', name: 'Jackie', image: slotJackie, weight: 12, payout2: 1, payout3: 7, payout4: 20, payout5: 90 },
  { id: 'judy', name: 'Judy', image: slotJudy, weight: 11, payout2: 1, payout3: 8, payout4: 22, payout5: 100 },
  { id: 'panam', name: 'Panam', image: slotPanam, weight: 11, payout2: 1, payout3: 8, payout4: 22, payout5: 100 },
  { id: 'rogue', name: 'Rogue', image: slotRogue, weight: 10, payout2: 1, payout3: 9, payout4: 24, payout5: 110 },
  { id: 'kerry', name: 'Kerry', image: slotKerry, weight: 10, payout2: 1, payout3: 9, payout4: 24, payout5: 110 },
  { id: 'river', name: 'River', image: slotRiver, weight: 10, payout2: 1, payout3: 9, payout4: 24, payout5: 110 },
  { id: 'viktor', name: 'Viktor', image: slotViktor, weight: 9, payout2: 1, payout3: 10, payout4: 26, payout5: 120 },
  { id: 'evelyn', name: 'Evelyn', image: slotEvelyn, weight: 9, payout2: 1, payout3: 10, payout4: 26, payout5: 120 },
  { id: 'hands', name: 'Hands', image: slotHands, weight: 9, payout2: 1, payout3: 10, payout4: 28, payout5: 130 },
  { id: 'wakako', name: 'Wakako', image: slotWakako, weight: 9, payout2: 1, payout3: 10, payout4: 28, payout5: 130 },
  { id: 'tbug', name: 'T-Bug', image: slotTbug, weight: 8, payout2: 2, payout3: 11, payout4: 30, payout5: 140 },
  { id: 'mitch', name: 'Mitch', image: slotMitch, weight: 8, payout2: 2, payout3: 11, payout4: 30, payout5: 140 },
  { id: 'takemura', name: 'Takemura', image: slotTakemura, weight: 8, payout2: 2, payout3: 12, payout4: 32, payout5: 150 },
  { id: 'reed', name: 'Reed', image: slotReed, weight: 8, payout2: 2, payout3: 12, payout4: 32, payout5: 150 },
  { id: 'alt', name: 'Alt', image: slotAlt, weight: 7, payout2: 2, payout3: 13, payout4: 36, payout5: 170 },
  { id: 'dex', name: 'Dex', image: slotDex, weight: 7, payout2: 2, payout3: 13, payout4: 36, payout5: 170 },
  { id: 'myers', name: 'Myers', image: slotMyers, weight: 7, payout2: 2, payout3: 14, payout4: 38, payout5: 180 },
  { id: 'songbird', name: 'Songbird', image: slotSongbird, weight: 6, payout2: 2, payout3: 16, payout4: 42, payout5: 200 },
  { id: 'hansen', name: 'Hansen', image: slotHansen, weight: 6, payout2: 2, payout3: 16, payout4: 42, payout5: 200 },
  { id: 'hanako', name: 'Hanako', image: slotHanako, weight: 5, payout2: 3, payout3: 18, payout4: 50, payout5: 240 },
  { id: 'yorinobu', name: 'Yorinobu', image: slotYorinobu, weight: 5, payout2: 3, payout3: 18, payout4: 50, payout5: 240 },
  { id: 'johnny', name: 'Johnny', image: slotJohnny, weight: 5, payout2: 3, payout3: 20, payout4: 55, payout5: 260 },
  { id: 'smasher', name: 'Smasher', image: slotSmasher, weight: 3, payout2: 4, payout3: 28, payout4: 80, payout5: 400 },
]

const THEMES: { ids: string[]; label: string; mult: number }[] = [
  { ids: ['hanako', 'yorinobu', 'takemura', 'smasher'], label: 'ARASAKA TOWER', mult: 50 },
  { ids: ['reed', 'myers', 'songbird', 'hansen'], label: 'PHANTOM LIBERTY', mult: 45 },
  { ids: ['v', 'jackie', 'tbug', 'dex'], label: 'THE HEIST', mult: 32 },
  { ids: ['rogue', 'johnny', 'kerry', 'v'], label: 'AFTERLIFE', mult: 28 },
  { ids: ['hanako', 'yorinobu', 'takemura'], label: 'ARASAKA BLOOD', mult: 22 },
  { ids: ['reed', 'myers', 'songbird'], label: 'NUSA DIRECTIVE', mult: 20 },
  { ids: ['johnny', 'alt', 'v'], label: 'RELIC SYNC', mult: 20 },
  { ids: ['johnny', 'kerry', 'rogue'], label: 'SAMURAI', mult: 18 },
  { ids: ['hansen', 'hands', 'reed'], label: 'DOGTOWN DEAL', mult: 18 },
  { ids: ['v', 'jackie', 'tbug'], label: 'KONPEKI CREW', mult: 16 },
  { ids: ['panam', 'mitch', 'v'], label: 'ALDECALDOS', mult: 16 },
  { ids: ['judy', 'evelyn', 'v'], label: 'BRAINDANCE', mult: 16 },
  { ids: ['rogue', 'hands', 'wakako'], label: 'FIXER NETWORK', mult: 16 },
  { ids: ['v', 'viktor', 'jackie'], label: 'WATSON', mult: 14 },
  { ids: ['v', 'river', 'jackie'], label: 'NCPD FILE', mult: 14 },
]

function themeNames(ids: string[]): string {
  return ids
    .map(id => SYMBOLS_5.find(symbol => symbol.id === id)?.name ?? id)
    .join(', ')
}

function poolFor(reels: SlotReelCount): SlotSymbol[] {
  return reels === 5 ? SYMBOLS_5 : SYMBOLS_3
}

function pickSymbol(pool: SlotSymbol[]): SlotSymbol {
  const total = pool.reduce((sum, symbol) => sum + symbol.weight, 0)
  let roll = Math.random() * total
  for (const symbol of pool) {
    roll -= symbol.weight
    if (roll <= 0) return symbol
  }
  return pool[0]
}

function buildStrip(visible: [SlotSymbol, SlotSymbol, SlotSymbol], pool: SlotSymbol[]): SlotSymbol[] {
  const strip = Array.from({ length: STRIP_LENGTH }, () => pickSymbol(pool))
  strip[LAND_INDEX - 1] = visible[0]
  strip[LAND_INDEX] = visible[1]
  strip[LAND_INDEX + 1] = visible[2]
  return strip
}

function idleStrips(reels: SlotReelCount): SlotSymbol[][] {
  const pool = poolFor(reels)
  return Array.from({ length: reels }, () => (
    buildStrip([pickSymbol(pool), pickSymbol(pool), pickSymbol(pool)], pool)
  ))
}

function idleOffsets(reels: SlotReelCount): number[] {
  return Array.from({ length: reels }, () => reelOffset(LAND_INDEX))
}

interface CellPos {
  reel: number
  row: number
}

interface SpinOutcome {
  win: number
  label: string
  jackpot: boolean
  hits: CellPos[]
}

function cellKey(cell: CellPos): string {
  return `${cell.reel}:${cell.row}`
}

function payoutForCount(symbol: SlotSymbol, count: number): number {
  if (count >= 5) return symbol.payout5
  if (count === 4) return symbol.payout4
  if (count === 3) return symbol.payout3
  if (count === 2) return symbol.payout2
  return 0
}

function consecutiveRuns(symbols: SlotSymbol[], cells: CellPos[]): { symbol: SlotSymbol; cells: CellPos[] }[] {
  const runs: { symbol: SlotSymbol; cells: CellPos[] }[] = []
  let start = 0
  while (start < symbols.length) {
    let end = start + 1
    while (end < symbols.length && symbols[end].id === symbols[start].id) end++
    if (end - start >= 3) {
      runs.push({ symbol: symbols[start], cells: cells.slice(start, end) })
    }
    start = end
  }
  return runs
}

const FIVE_LINES: { kind: 'horizontal' | 'vertical' | 'diagonal'; cells: CellPos[] }[] = [
  { kind: 'horizontal', cells: [0, 1, 2, 3, 4].map(reel => ({ reel, row: 0 })) },
  { kind: 'horizontal', cells: [0, 1, 2, 3, 4].map(reel => ({ reel, row: 1 })) },
  { kind: 'horizontal', cells: [0, 1, 2, 3, 4].map(reel => ({ reel, row: 2 })) },
  { kind: 'vertical', cells: [0, 1, 2].map(row => ({ reel: 0, row })) },
  { kind: 'vertical', cells: [0, 1, 2].map(row => ({ reel: 1, row })) },
  { kind: 'vertical', cells: [0, 1, 2].map(row => ({ reel: 2, row })) },
  { kind: 'vertical', cells: [0, 1, 2].map(row => ({ reel: 3, row })) },
  { kind: 'vertical', cells: [0, 1, 2].map(row => ({ reel: 4, row })) },
  { kind: 'diagonal', cells: [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }] },
  { kind: 'diagonal', cells: [{ reel: 1, row: 0 }, { reel: 2, row: 1 }, { reel: 3, row: 2 }] },
  { kind: 'diagonal', cells: [{ reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }] },
  { kind: 'diagonal', cells: [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }] },
  { kind: 'diagonal', cells: [{ reel: 1, row: 2 }, { reel: 2, row: 1 }, { reel: 3, row: 0 }] },
  { kind: 'diagonal', cells: [{ reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }] },
  { kind: 'diagonal', cells: [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }] },
  { kind: 'diagonal', cells: [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }] },
]

const LINE_KIND_LABEL: Record<'horizontal' | 'vertical' | 'diagonal', string> = {
  horizontal: 'ГОРИЗОНТ',
  vertical: 'ВЕРТИКАЛЬ',
  diagonal: 'ДИАГОНАЛЬ',
}

function evaluateThree(results: SlotSymbol[], bet: number): SpinOutcome {
  const [left, center, right] = results
  const hits = (reels: number[]): CellPos[] => reels.map(reel => ({ reel, row: 1 }))
  if (left.id === center.id && center.id === right.id) {
    return {
      win: bet * left.payout3,
      label: `ТРИ ${left.name.toUpperCase()}`,
      jackpot: left.payout3 >= 50,
      hits: hits([0, 1, 2]),
    }
  }
  if (left.id === center.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false, hits: hits([0, 1]) }
  }
  if (center.id === right.id) {
    return { win: bet * center.payout2, label: `ПАРА // ${center.name}`, jackpot: false, hits: hits([1, 2]) }
  }
  if (left.id === right.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false, hits: hits([0, 2]) }
  }
  return { win: 0, label: 'NO PAYOUT', jackpot: false, hits: [] }
}

function evaluateFiveGrid(grid: SlotSymbol[][], bet: number): SpinOutcome {
  const labels: string[] = []
  const hitMap = new Map<string, CellPos>()
  let kindWin = 0
  let jackpot = false

  const addHits = (cells: CellPos[]) => {
    for (const cell of cells) hitMap.set(cellKey(cell), cell)
  }

  for (const line of FIVE_LINES) {
    const symbols = line.cells.map(cell => grid[cell.row][cell.reel])
    const minCount = line.kind === 'vertical' ? 3 : 3
    for (const run of consecutiveRuns(symbols, line.cells)) {
      if (run.cells.length < minCount) continue
      const count = run.cells.length
      const pay = payoutForCount(run.symbol, Math.min(count, 5))
      if (pay <= 0) continue
      kindWin += bet * pay
      const countLabel = count >= 5 ? 'ПЯТЬ' : count === 4 ? 'ЧЕТЫРЕ' : 'ТРИ'
      labels.push(`${countLabel} ${run.symbol.name.toUpperCase()} // ${LINE_KIND_LABEL[line.kind]}`)
      addHits(run.cells)
      if (count >= 5) jackpot = true
    }
  }

  const themeLabels: string[] = []
  let themeWin = 0
  for (const theme of THEMES) {
    const themeCells: CellPos[] = []
    for (const line of FIVE_LINES) {
      const ids = new Set(line.cells.map(cell => grid[cell.row][cell.reel].id))
      if (!theme.ids.every(id => ids.has(id))) continue
      for (const cell of line.cells) {
        if (theme.ids.includes(grid[cell.row][cell.reel].id)) themeCells.push(cell)
      }
    }
    if (themeCells.length === 0) continue
    themeWin += bet * theme.mult
    themeLabels.push(theme.label)
    addHits(themeCells)
    if (theme.mult >= 32) jackpot = true
  }

  const win = kindWin + themeWin
  const parts = [...labels, ...themeLabels]
  return {
    win,
    label: win > 0 ? parts.join(' + ') : 'NO PAYOUT',
    jackpot,
    hits: [...hitMap.values()],
  }
}

function reelOffset(index: number): number {
  return -(index - 1) * SYMBOL_SIZE
}

function stopTimes(reels: SlotReelCount): readonly number[] {
  return reels === 5 ? STOP_MS_5 : STOP_MS_3
}

export default function NightCitySlots({
  active = true,
  reelCount,
  onSpinningChange,
}: {
  active?: boolean
  reelCount: SlotReelCount
  onSpinningChange?: (spinning: boolean) => void
}) {
  const [credits, setCredits] = useState(STARTING_EDDIES)
  const [best, setBest] = useState(STARTING_EDDIES)
  const [bet, setBet] = useState<(typeof BETS)[number]>(25)
  const [strips, setStrips] = useState<SlotSymbol[][]>(() => idleStrips(reelCount))
  const [offsets, setOffsets] = useState(() => idleOffsets(reelCount))
  const [armed, setArmed] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [status, setStatus] = useState('Вставьте эдди и крутите барабаны.')
  const [lastWin, setLastWin] = useState(0)
  const [jackpot, setJackpot] = useState(false)
  const [hits, setHits] = useState<Set<string>>(() => new Set())
  const spinTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const storedCredits = Number(localStorage.getItem('cyber-slots-credits') ?? STARTING_EDDIES)
    const storedBest = Number(localStorage.getItem('cyber-slots-best') ?? storedCredits)
    setCredits(Number.isFinite(storedCredits) ? Math.max(0, storedCredits) : STARTING_EDDIES)
    setBest(Number.isFinite(storedBest) ? Math.max(0, storedBest) : STARTING_EDDIES)
  }, [])

  useEffect(() => {
    if (spinning) return
    setStrips(idleStrips(reelCount))
    setOffsets(idleOffsets(reelCount))
    setArmed(true)
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    setStatus(reelCount === 5
      ? 'Пять барабанов. Линии: горизонт, вертикаль и диагональ.'
      : 'Вставьте эдди и крутите барабаны.')
  }, [reelCount])

  const persistCredits = useCallback((nextCredits: number) => {
    localStorage.setItem('cyber-slots-credits', String(nextCredits))
    setBest(currentBest => {
      const nextBest = Math.max(currentBest, nextCredits)
      localStorage.setItem('cyber-slots-best', String(nextBest))
      return nextBest
    })
  }, [])

  const spin = useCallback(() => {
    if (spinning) return
    if (credits < bet) {
      setStatus('Недостаточно эдди.')
      return
    }

    const pool = poolFor(reelCount)
    const nextCredits = credits - bet
    const visibles = Array.from({ length: reelCount }, () => (
      [pickSymbol(pool), pickSymbol(pool), pickSymbol(pool)] as [SlotSymbol, SlotSymbol, SlotSymbol]
    ))
    const outcome = reelCount === 5
      ? evaluateFiveGrid(
          [0, 1, 2].map(row => visibles.map(visible => visible[row])),
          bet,
        )
      : evaluateThree(visibles.map(visible => visible[1]), bet)
    const nextStrips = visibles.map(visible => buildStrip(visible, pool))
    const times = stopTimes(reelCount)

    setCredits(nextCredits)
    persistCredits(nextCredits)
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    setStatus('БАРАБАНЫ ВРАЩАЮТСЯ...')
    setSpinning(true)
    onSpinningChange?.(true)
    setArmed(false)
    setStrips(nextStrips)
    setOffsets(Array.from({ length: reelCount }, () => 0))

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArmed(true)
        setOffsets(idleOffsets(reelCount))
      })
    })

    if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current)
    spinTimerRef.current = window.setTimeout(() => {
      const finalCredits = nextCredits + outcome.win
      setCredits(finalCredits)
      persistCredits(finalCredits)
      setLastWin(outcome.win)
      setJackpot(outcome.jackpot)
      setHits(new Set(outcome.hits.map(cellKey)))
      setStatus(outcome.win > 0 ? `${outcome.label}  +${outcome.win}` : outcome.label)
      setSpinning(false)
      onSpinningChange?.(false)
      spinTimerRef.current = null
    }, times[times.length - 1] + 80)
  }, [bet, credits, onSpinningChange, persistCredits, reelCount, spinning])

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!active) return
      if (event.code !== 'Space' && event.key !== 'Enter') return
      event.preventDefault()
      spin()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, spin])

  const reboot = () => {
    if (spinning) return
    setCredits(STARTING_EDDIES)
    persistCredits(STARTING_EDDIES)
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    setStatus('Счётчик эдди перезагружен.')
  }

  const paytable = useMemo(
    () => [...poolFor(reelCount)].sort((left, right) => right.payout3 - left.payout3),
    [reelCount],
  )
  const times = stopTimes(reelCount)

  return (
    <div className={`flex w-full flex-col items-center ${reelCount === 5 ? 'max-w-[760px]' : 'max-w-[560px]'}`}>
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <div className="cyber-accent-text flex items-center gap-2">
          <Coins className="h-5 w-5" />
          <span className="font-bold tracking-widest">AFTERLIFE REELS</span>
        </div>
        <button
          onClick={reboot}
          disabled={spinning}
          className="cyber-btn-accent inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" /> ПОПОЛНИТЬ
        </button>
      </div>

      <div className={`cyber-slots relative w-full border-2 p-4 ${jackpot ? 'is-jackpot' : ''} ${lastWin > 0 && !spinning ? 'is-win' : ''}`}>
        <div className="cyber-slots-lights mb-3 flex justify-between gap-1" aria-hidden="true">
          {Array.from({ length: reelCount === 5 ? 17 : 13 }, (_, index) => (
            <span key={index} className="cyber-slots-light" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>

        <div
          className={`cyber-slots-window relative grid gap-2 border p-2 ${reelCount === 5 ? 'grid-cols-5' : 'grid-cols-3'}`}
          style={{ ['--slot-size' as string]: `${SYMBOL_SIZE}px` }}
        >
          {reelCount === 3 && (
            <div className="cyber-payline-center pointer-events-none absolute z-20" />
          )}
          {strips.map((strip, reelIndex) => (
            <div key={reelIndex} className="cyber-reel relative overflow-hidden">
              <div
                className={`cyber-reel-strip ${armed ? 'is-armed' : ''} ${spinning ? 'is-spinning' : ''}`}
                style={{
                  transform: `translateY(${offsets[reelIndex]}px)`,
                  transitionDuration: armed ? `${times[reelIndex]}ms` : '0ms',
                }}
              >
                {strip.map((symbol, symbolIndex) => {
                  const row = symbolIndex - (LAND_INDEX - 1)
                  const isHit = !spinning && row >= 0 && row <= 2 && hits.has(`${reelIndex}:${row}`)
                  return (
                    <div
                      key={`${reelIndex}-${symbolIndex}`}
                      className={`cyber-reel-cell relative overflow-hidden border ${isHit ? 'is-hit' : ''}`}
                      style={{ height: SYMBOL_SIZE, width: '100%' }}
                    >
                      <Image
                        src={symbol.image}
                        alt={symbol.name}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                      <span className="cyber-reel-name">{symbol.name}</span>
                      {isHit && <span className="cyber-reel-hit-mark">WIN</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {BETS.map(value => (
              <button
                key={value}
                disabled={spinning}
                onClick={() => setBet(value)}
                className={`border px-2.5 py-1.5 font-mono text-xs font-bold ${
                  bet === value ? 'cyber-btn-accent' : 'cyber-btn-line'
                } disabled:opacity-40`}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            onClick={spin}
            disabled={spinning || credits < bet}
            className="cyber-slots-spin border px-8 py-2.5 text-sm font-black tracking-[.25em] disabled:opacity-40"
          >
            {spinning ? 'SPIN...' : 'SPIN'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid w-full grid-cols-3 gap-3">
        <div className="cyber-stat-panel border-l-4 p-3">
          <div className="cyber-muted text-[10px]">ЭДДИ</div>
          <div className="cyber-number text-xl font-black">{credits}</div>
        </div>
        <div className="cyber-stat-panel border-l-4 p-3">
          <div className="cyber-muted text-[10px]">СТАВКА</div>
          <div className="cyber-number text-xl font-black">{bet}</div>
        </div>
        <div className="cyber-stat-panel border-l-4 p-3">
          <div className="cyber-muted text-[10px]">РЕКОРД</div>
          <div className="cyber-number text-xl font-black">{best}</div>
        </div>
      </div>

      <div className={`mt-3 w-full border px-3 py-2 text-center font-mono text-xs ${
        lastWin > 0 && !spinning ? 'cyber-hot-text' : 'cyber-muted'
      }`}>
        {status}
      </div>

      <section className="cyber-help mt-4 w-full border p-3 text-[11px]">
        <div className="cyber-text mb-2 font-bold">ВЫПЛАТЫ × СТАВКА</div>
        {reelCount === 5 ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {paytable.map(symbol => (
                <div key={symbol.id} className="flex items-center justify-between gap-2">
                  <span>{symbol.name}</span>
                  <span className="cyber-number font-mono">
                    5×{symbol.payout5} / 4×{symbol.payout4} / 3×{symbol.payout3}
                  </span>
                </div>
              ))}
            </div>
            <div className="cyber-text mt-3 mb-1 font-bold">СЮЖЕТНЫЕ СВЯЗКИ</div>
            <div className="grid grid-cols-1 gap-y-1.5">
              {THEMES.map(theme => (
                <div key={theme.label} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-bold">{theme.label}</span>
                    <span className="cyber-muted"> — {themeNames(theme.ids)}</span>
                  </span>
                  <span className="cyber-number shrink-0 font-mono">×{theme.mult}</span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              Пробел или Enter — крутить. Сеты из трёх и больше собираются по горизонтали, вертикали и диагонали. Сработавшая линия подсвечивается. Связки от трёх персонажей одной фракции суммируются.
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {paytable.map(symbol => (
                <div key={symbol.id} className="flex items-center justify-between gap-2">
                  <span>{symbol.name}</span>
                  <span className="cyber-number font-mono">3×{symbol.payout3} / 2×{symbol.payout2}</span>
                </div>
              ))}
            </div>
            <div className="mt-2">Пробел или Enter — крутить. Выигрыш считается по центральной жёлтой линии.</div>
          </>
        )}
      </section>
    </div>
  )
}
