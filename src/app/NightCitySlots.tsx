'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type StaticImageData } from 'next/image'
import { Coins, RotateCcw } from 'lucide-react'
import NightCityContracts from './NightCityContracts'
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
import slotSaburo from './slots/slot-saburo.png'
import slotBryce from './slots/slot-bryce.png'
import slotSpider from './slots/slot-spider.png'
import slotPlacide from './slots/slot-placide.png'
import slotBrigitte from './slots/slot-brigitte.png'
import slotRoyce from './slots/slot-royce.png'
import slotDavid from './slots/slot-david.png'
import slotLucy from './slots/slot-lucy.png'
import slotAurore from './slots/slot-aurore.png'
import slotAuroreHack from './slots/slot-aurore-hack.png'
import slotRegina from './slots/slot-regina.png'
import slotPadre from './slots/slot-padre.png'
import slotSkye from './slots/slot-skye.png'
import slotSaul from './slots/slot-saul.png'
import slotJefferson from './slots/slot-jefferson.png'
import slotBlueEyes from './slots/slot-blueeyes.png'

export type SlotReelCount = 3 | 5

const SYMBOL_SIZE = 112
const STRIP_LENGTH = 28
const LAND_INDEX = 24
const STARTING_EDDIES = 5000
const FREE_SPIN_COUNT = 10
const AURORE_FREE_SPIN_COUNT = 5
const AURORE_GUARANTEE_SPINS = 70
const SABURO_GUARANTEE_SPINS = 180
const AURORE_SPIN_CHANCE = 1 / 48
const HACK_MS = 3800
const ARASAKA_MS = 3800
const BETS = [100, 250, 500, 1000] as const
const MIN_BET = 1
const MAX_BET = 1_000_000
const STOP_MS_3 = [1400, 2100, 2800] as const
const STOP_MS_5 = [1100, 1500, 1900, 2300, 2800] as const
const STOP_MS_AURORE_HACK = [1600, 2100, 2600, 3100, 3600] as const

type BonusKind = 'saburo' | 'aurore'
type OverlayKind = 'aurore' | 'arasaka'

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
  { id: 'v', name: 'V', image: slotV, weight: 12, payout2: 1, payout3: 2, payout4: 5, payout5: 16 },
  { id: 'jackie', name: 'Jackie', image: slotJackie, weight: 11, payout2: 1, payout3: 2, payout4: 5, payout5: 18 },
  { id: 'judy', name: 'Judy', image: slotJudy, weight: 10, payout2: 1, payout3: 2, payout4: 6, payout5: 20 },
  { id: 'panam', name: 'Panam', image: slotPanam, weight: 10, payout2: 1, payout3: 2, payout4: 6, payout5: 20 },
  { id: 'rogue', name: 'Rogue', image: slotRogue, weight: 10, payout2: 1, payout3: 2, payout4: 6, payout5: 22 },
  { id: 'kerry', name: 'Kerry', image: slotKerry, weight: 10, payout2: 1, payout3: 2, payout4: 6, payout5: 22 },
  { id: 'river', name: 'River', image: slotRiver, weight: 10, payout2: 1, payout3: 2, payout4: 6, payout5: 22 },
  { id: 'viktor', name: 'Viktor', image: slotViktor, weight: 9, payout2: 1, payout3: 3, payout4: 7, payout5: 24 },
  { id: 'evelyn', name: 'Evelyn', image: slotEvelyn, weight: 9, payout2: 1, payout3: 3, payout4: 7, payout5: 24 },
  { id: 'hands', name: 'Hands', image: slotHands, weight: 9, payout2: 1, payout3: 3, payout4: 7, payout5: 26 },
  { id: 'wakako', name: 'Wakako', image: slotWakako, weight: 9, payout2: 1, payout3: 3, payout4: 7, payout5: 26 },
  { id: 'tbug', name: 'T-Bug', image: slotTbug, weight: 8, payout2: 1, payout3: 3, payout4: 8, payout5: 28 },
  { id: 'mitch', name: 'Mitch', image: slotMitch, weight: 8, payout2: 1, payout3: 3, payout4: 8, payout5: 28 },
  { id: 'takemura', name: 'Takemura', image: slotTakemura, weight: 8, payout2: 1, payout3: 3, payout4: 8, payout5: 30 },
  { id: 'reed', name: 'Reed', image: slotReed, weight: 8, payout2: 1, payout3: 3, payout4: 8, payout5: 30 },
  { id: 'alt', name: 'Alt', image: slotAlt, weight: 7, payout2: 1, payout3: 4, payout4: 10, payout5: 34 },
  { id: 'dex', name: 'Dex', image: slotDex, weight: 7, payout2: 1, payout3: 4, payout4: 10, payout5: 34 },
  { id: 'myers', name: 'Myers', image: slotMyers, weight: 7, payout2: 1, payout3: 4, payout4: 10, payout5: 36 },
  { id: 'songbird', name: 'Songbird', image: slotSongbird, weight: 6, payout2: 1, payout3: 4, payout4: 12, payout5: 40 },
  { id: 'hansen', name: 'Hansen', image: slotHansen, weight: 6, payout2: 1, payout3: 4, payout4: 12, payout5: 40 },
  { id: 'hanako', name: 'Hanako', image: slotHanako, weight: 5, payout2: 2, payout3: 5, payout4: 14, payout5: 48 },
  { id: 'yorinobu', name: 'Yorinobu', image: slotYorinobu, weight: 5, payout2: 1, payout3: 5, payout4: 14, payout5: 48 },
  { id: 'johnny', name: 'Johnny', image: slotJohnny, weight: 5, payout2: 2, payout3: 6, payout4: 16, payout5: 55 },
  { id: 'smasher', name: 'Smasher', image: slotSmasher, weight: 3, payout2: 3, payout3: 8, payout4: 22, payout5: 70 },
  { id: 'saburo', name: 'Saburo', image: slotSaburo, weight: 6, payout2: 0, payout3: 0, payout4: 0, payout5: 0 },
]

const SYMBOL_AURORE_HACK: SlotSymbol = {
  id: 'aurore-hack',
  name: 'Aurore',
  image: slotAuroreHack,
  weight: 0,
  payout2: 0,
  payout3: 0,
  payout4: 0,
  payout5: 0,
}

const SYMBOLS_FREE: SlotSymbol[] = [
  { id: 'bryce', name: 'Bryce', image: slotBryce, weight: 12, payout2: 1, payout3: 3, payout4: 8, payout5: 22 },
  { id: 'spider', name: 'Spider', image: slotSpider, weight: 11, payout2: 1, payout3: 3, payout4: 8, payout5: 24 },
  { id: 'placide', name: 'Placide', image: slotPlacide, weight: 11, payout2: 1, payout3: 3, payout4: 8, payout5: 24 },
  { id: 'brigitte', name: 'Brigitte', image: slotBrigitte, weight: 10, payout2: 1, payout3: 4, payout4: 10, payout5: 28 },
  { id: 'royce', name: 'Royce', image: slotRoyce, weight: 9, payout2: 1, payout3: 4, payout4: 12, payout5: 32 },
  { id: 'david', name: 'David', image: slotDavid, weight: 8, payout2: 2, payout3: 5, payout4: 14, payout5: 40 },
  { id: 'lucy', name: 'Lucy', image: slotLucy, weight: 8, payout2: 2, payout3: 5, payout4: 14, payout5: 40 },
]

const SYMBOLS_AURORE_FREE: SlotSymbol[] = [
  { id: 'regina', name: 'Regina', image: slotRegina, weight: 12, payout2: 1, payout3: 3, payout4: 8, payout5: 22 },
  { id: 'padre', name: 'Padre', image: slotPadre, weight: 11, payout2: 1, payout3: 3, payout4: 8, payout5: 24 },
  { id: 'skye', name: 'Skye', image: slotSkye, weight: 11, payout2: 1, payout3: 3, payout4: 8, payout5: 24 },
  { id: 'saul', name: 'Saul', image: slotSaul, weight: 10, payout2: 1, payout3: 4, payout4: 10, payout5: 28 },
  { id: 'jefferson', name: 'Jefferson', image: slotJefferson, weight: 9, payout2: 1, payout3: 4, payout4: 12, payout5: 32 },
  { id: 'blueeyes', name: 'Blue Eyes', image: slotBlueEyes, weight: 8, payout2: 2, payout3: 5, payout4: 14, payout5: 40 },
  { id: 'aurore', name: 'Aurore', image: slotAurore, weight: 8, payout2: 2, payout3: 5, payout4: 14, payout5: 40 },
]

const THEMES: { ids: string[]; label: string; mult: number }[] = [
  { ids: ['hanako', 'yorinobu', 'takemura', 'smasher'], label: 'ARASAKA TOWER', mult: 8 },
  { ids: ['reed', 'myers', 'songbird', 'hansen'], label: 'PHANTOM LIBERTY', mult: 7 },
  { ids: ['v', 'jackie', 'tbug', 'dex'], label: 'THE HEIST', mult: 5 },
  { ids: ['rogue', 'johnny', 'kerry', 'v'], label: 'AFTERLIFE', mult: 5 },
  { ids: ['hanako', 'yorinobu', 'takemura'], label: 'ARASAKA BLOOD', mult: 3 },
  { ids: ['reed', 'myers', 'songbird'], label: 'NUSA DIRECTIVE', mult: 3 },
  { ids: ['johnny', 'alt', 'v'], label: 'RELIC SYNC', mult: 3 },
  { ids: ['johnny', 'kerry', 'rogue'], label: 'SAMURAI', mult: 3 },
  { ids: ['hansen', 'hands', 'reed'], label: 'DOGTOWN DEAL', mult: 3 },
  { ids: ['v', 'jackie', 'tbug'], label: 'KONPEKI CREW', mult: 2 },
  { ids: ['panam', 'mitch', 'v'], label: 'ALDECALDOS', mult: 2 },
  { ids: ['judy', 'evelyn', 'v'], label: 'BRAINDANCE', mult: 2 },
  { ids: ['rogue', 'hands', 'wakako'], label: 'FIXER NETWORK', mult: 2 },
  { ids: ['v', 'viktor', 'jackie'], label: 'WATSON', mult: 2 },
  { ids: ['v', 'river', 'jackie'], label: 'NCPD FILE', mult: 2 },
]

function parseBet(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const value = Number(digits)
  if (!Number.isFinite(value) || value < MIN_BET) return null
  return Math.min(MAX_BET, Math.floor(value))
}

function themeNames(ids: string[]): string {
  return ids
    .map(id => SYMBOLS_5.find(symbol => symbol.id === id)?.name ?? id)
    .join(', ')
}

function symbolSrc(symbol: SlotSymbol): string {
  return symbol.image.src
}

const PRELOAD_POOLS: SlotSymbol[][] = [
  SYMBOLS_3,
  SYMBOLS_5,
  SYMBOLS_FREE,
  SYMBOLS_AURORE_FREE,
  [SYMBOL_AURORE_HACK],
]

const PRELOAD_SRCS = [...new Set(PRELOAD_POOLS.flatMap(pool => pool.map(symbolSrc)))]

function preloadSlotImages() {
  if (typeof window === 'undefined') return
  for (const src of PRELOAD_SRCS) {
    const image = new window.Image()
    image.decoding = 'async'
    image.src = src
    void image.decode?.().catch(() => undefined)
  }
}

function poolFor(reels: SlotReelCount, free = false, kind: BonusKind = 'saburo'): SlotSymbol[] {
  if (reels === 5 && free) return kind === 'aurore' ? SYMBOLS_AURORE_FREE : SYMBOLS_FREE
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

function idleStrips(reels: SlotReelCount, free = false): SlotSymbol[][] {
  const pool = poolFor(reels, free)
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
  freeSpins: number
  bonusKind?: BonusKind
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
      freeSpins: 0,
    }
  }
  if (left.id === center.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false, hits: hits([0, 1]), freeSpins: 0 }
  }
  if (center.id === right.id) {
    return { win: bet * center.payout2, label: `ПАРА // ${center.name}`, jackpot: false, hits: hits([1, 2]), freeSpins: 0 }
  }
  if (left.id === right.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false, hits: hits([0, 2]), freeSpins: 0 }
  }
  return { win: 0, label: 'NO PAYOUT', jackpot: false, hits: [], freeSpins: 0 }
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
      if (run.symbol.id === 'saburo' || run.symbol.id === 'aurore-hack') continue
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
      if (line.cells.length < 5) continue
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
    if (theme.mult >= 7) jackpot = true
  }

  const allAurore = grid.length >= 3
    && grid[0].length >= 5
    && grid.every(row => row.every(symbol => symbol.id === 'aurore-hack'))
  if (allAurore) {
    const allCells: CellPos[] = []
    for (let row = 0; row < 3; row++) {
      for (let reel = 0; reel < 5; reel++) allCells.push({ reel, row })
    }
    addHits(allCells)
    labels.unshift('AURORE CASSEL // BREACH // 5 FREE SPINS')
    return {
      win: kindWin + themeWin,
      label: [...labels, ...themeLabels].join(' + '),
      jackpot: true,
      hits: [...hitMap.values()],
      freeSpins: AURORE_FREE_SPIN_COUNT,
      bonusKind: 'aurore',
    }
  }

  const saburoHits: CellPos[] = []
  for (const line of FIVE_LINES) {
    if (line.cells.length < 5) continue
    const allSaburo = line.cells.every(cell => grid[cell.row][cell.reel].id === 'saburo')
    if (!allSaburo) continue
    addHits(line.cells)
    saburoHits.push(...line.cells)
  }
  const freeSpins = saburoHits.length > 0 ? FREE_SPIN_COUNT : 0
  if (freeSpins > 0) {
    labels.unshift('SABURO ARASAKA ×5 // 10 FREE SPINS')
    jackpot = true
  }

  const win = kindWin + themeWin
  const parts = [...labels, ...themeLabels]
  return {
    win,
    label: parts.length > 0 ? parts.join(' + ') : 'NO PAYOUT',
    jackpot,
    hits: [...hitMap.values()],
    freeSpins,
    bonusKind: freeSpins > 0 ? 'saburo' : undefined,
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
  unlockRefillSignal = 0,
  forceSaburoSignal = 0,
  forceAuroreSignal = 0,
  preset = 'classic',
}: {
  active?: boolean
  reelCount: SlotReelCount
  onSpinningChange?: (spinning: boolean) => void
  unlockRefillSignal?: number
  forceSaburoSignal?: number
  forceAuroreSignal?: number
  preset?: 'classic' | 'arasaka' | 'silverhand'
}) {
  const [credits, setCredits] = useState(STARTING_EDDIES)
  const [best, setBest] = useState(STARTING_EDDIES)
  const [bet, setBet] = useState(250)
  const [customBet, setCustomBet] = useState('')
  const [strips, setStrips] = useState<SlotSymbol[][]>(() => idleStrips(reelCount))
  const [offsets, setOffsets] = useState(() => idleOffsets(reelCount))
  const [armed, setArmed] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [status, setStatus] = useState('Вставьте эдди и крутите барабаны.')
  const [lastWin, setLastWin] = useState(0)
  const [jackpot, setJackpot] = useState(false)
  const [hits, setHits] = useState<Set<string>>(() => new Set())
  const [quizBusy, setQuizBusy] = useState(false)
  const [refillLocked, setRefillLocked] = useState(false)
  const [bonus, setBonus] = useState<{ left: number; of: number; bank: number; kind: BonusKind } | null>(null)
  const [overlay, setOverlay] = useState<OverlayKind | null>(null)
  const spinTimerRef = useRef<number | null>(null)
  const forceSaburoRef = useRef(false)
  const forceAuroreRef = useRef(false)
  const auroreSpinCountRef = useRef(0)
  const saburoSpinCountRef = useRef(0)
  const inFreeSpins = bonus !== null

  useEffect(() => {
    preloadSlotImages()
    const storedCredits = Number(localStorage.getItem('cyber-slots-credits') ?? STARTING_EDDIES)
    const storedBest = Number(localStorage.getItem('cyber-slots-best') ?? storedCredits)
    const storedBet = parseBet(localStorage.getItem('cyber-slots-bet') ?? '')
    setCredits(Number.isFinite(storedCredits) ? Math.max(0, storedCredits) : STARTING_EDDIES)
    setBest(Number.isFinite(storedBest) ? Math.max(0, storedBest) : STARTING_EDDIES)
    if (storedBet != null) {
      setBet(storedBet)
      if (!(BETS as readonly number[]).includes(storedBet)) setCustomBet(String(storedBet))
    }
    setRefillLocked(localStorage.getItem('cyber-slots-refill-locked') === '1')
    const storedAuroreSpins = Number(localStorage.getItem('cyber-slots-aurore-spins') ?? 0)
    auroreSpinCountRef.current = Number.isFinite(storedAuroreSpins)
      ? Math.max(0, Math.floor(storedAuroreSpins))
      : 0
    const storedSaburoSpins = Number(localStorage.getItem('cyber-slots-saburo-spins') ?? 0)
    saburoSpinCountRef.current = Number.isFinite(storedSaburoSpins)
      ? Math.max(0, Math.floor(storedSaburoSpins))
      : 0
  }, [])

  useEffect(() => {
    if (!unlockRefillSignal) return
    setRefillLocked(false)
    localStorage.setItem('cyber-slots-refill-locked', '0')
    setStatus('Терминал пополнения разблокирован.')
  }, [unlockRefillSignal])

  useEffect(() => {
    if (!forceSaburoSignal) return
    forceSaburoRef.current = true
  }, [forceSaburoSignal])

  useEffect(() => {
    if (!forceAuroreSignal) return
    forceAuroreRef.current = true
  }, [forceAuroreSignal])

  useEffect(() => {
    document.body.classList.toggle('cyber-hack-active', overlay === 'aurore')
    document.body.classList.toggle('cyber-arasaka-active', overlay === 'arasaka')
    return () => {
      document.body.classList.remove('cyber-hack-active')
      document.body.classList.remove('cyber-arasaka-active')
    }
  }, [overlay])

  useEffect(() => {
    if (spinning) return
    setBonus(null)
    setStrips(idleStrips(reelCount))
    setOffsets(idleOffsets(reelCount))
    setArmed(true)
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    setStatus(reelCount === 5
      ? 'Пять барабанов. Линия из пяти Saburo — 10 фриспинов. Полная сетка Aurore — 5 фриспинов.'
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

  const persistBet = useCallback((nextBet: number) => {
    setBet(nextBet)
    localStorage.setItem('cyber-slots-bet', String(nextBet))
  }, [])

  const selectPresetBet = (value: number) => {
    setCustomBet('')
    persistBet(value)
  }

  const onCustomBetChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    setCustomBet(digits)
    const parsed = parseBet(digits)
    if (parsed != null) persistBet(parsed)
  }

  const onCustomBetBlur = () => {
    const parsed = parseBet(customBet)
    if (parsed == null) {
      if (customBet.trim() === '') return
      setCustomBet(String(bet))
      return
    }
    persistBet(parsed)
    setCustomBet(String(parsed))
  }

  const spin = useCallback((mode: 'paid' | 'free' = 'paid') => {
    if (spinning) return
    const isFree = mode === 'free'
    if (isFree && reelCount !== 5) return
    if (!isFree && bonus) return
    if (!isFree && bet < MIN_BET) {
      setStatus('Укажите ставку.')
      return
    }
    if (!isFree && credits < bet) {
      setStatus('Недостаточно эдди.')
      return
    }

    const bonusKind = isFree ? (bonus?.kind ?? 'saburo') : 'saburo'
    const pool = poolFor(reelCount, isFree, bonusKind)
    const saburo = SYMBOLS_5.find(symbol => symbol.id === 'saburo')

    let forceAurore = false
    let forceEmperor = false
    if (!isFree && reelCount === 5) {
      auroreSpinCountRef.current += 1
      saburoSpinCountRef.current += 1
      forceAurore = forceAuroreRef.current
        || auroreSpinCountRef.current >= AURORE_GUARANTEE_SPINS
        || Math.random() < AURORE_SPIN_CHANCE
      if (forceAurore) {
        forceAuroreRef.current = false
        auroreSpinCountRef.current = 0
      }
      forceEmperor = !forceAurore && Boolean(saburo) && (
        forceSaburoRef.current
        || saburoSpinCountRef.current >= SABURO_GUARANTEE_SPINS
      )
      if (forceEmperor) {
        forceSaburoRef.current = false
        saburoSpinCountRef.current = 0
      }
      localStorage.setItem('cyber-slots-aurore-spins', String(auroreSpinCountRef.current))
      localStorage.setItem('cyber-slots-saburo-spins', String(saburoSpinCountRef.current))
    }

    const visibles = Array.from({ length: reelCount }, () => {
      if (forceAurore) {
        return [SYMBOL_AURORE_HACK, SYMBOL_AURORE_HACK, SYMBOL_AURORE_HACK] as [SlotSymbol, SlotSymbol, SlotSymbol]
      }
      if (forceEmperor && saburo) {
        return [saburo, saburo, saburo] as [SlotSymbol, SlotSymbol, SlotSymbol]
      }
      return [pickSymbol(pool), pickSymbol(pool), pickSymbol(pool)] as [SlotSymbol, SlotSymbol, SlotSymbol]
    })
    const nextCredits = isFree ? credits : credits - bet
    const outcome = reelCount === 5
      ? evaluateFiveGrid(
          [0, 1, 2].map(row => visibles.map(visible => visible[row])),
          bet,
        )
      : evaluateThree(visibles.map(visible => visible[1]), bet)
    const nextStrips = visibles.map(visible => (
      buildStrip(visible, forceAurore
        ? [SYMBOL_AURORE_HACK]
        : forceEmperor && saburo
          ? [saburo]
          : pool)
    ))
    const overlayKind: OverlayKind | null = forceAurore
      ? 'aurore'
      : (forceEmperor || outcome.bonusKind === 'saburo') ? 'arasaka' : null
    if (outcome.bonusKind === 'saburo' && saburoSpinCountRef.current !== 0) {
      saburoSpinCountRef.current = 0
      localStorage.setItem('cyber-slots-saburo-spins', '0')
    }
    const times = overlayKind ? STOP_MS_AURORE_HACK : stopTimes(reelCount)
    const settleMs = overlayKind === 'aurore'
      ? HACK_MS
      : overlayKind === 'arasaka'
        ? ARASAKA_MS
        : times[times.length - 1] + 80

    if (!isFree) {
      setCredits(nextCredits)
      persistCredits(nextCredits)
    }
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    if (overlayKind === 'aurore') {
      preloadSlotImages()
      setOverlay('aurore')
      setStatus('ВАС ВЗЛАМЫВАЮТ...')
    } else if (overlayKind === 'arasaka') {
      preloadSlotImages()
      setOverlay('arasaka')
      setStatus('ARASAKA PROTOCOL...')
    } else {
      setStatus(isFree
        ? `ФРИСПИН ${bonus ? bonus.of - bonus.left + 1 : 1}/${bonus?.of ?? FREE_SPIN_COUNT}`
        : 'БАРАБАНЫ ВРАЩАЮТСЯ...')
    }
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
      setSpinning(false)
      setOverlay(null)
      onSpinningChange?.(false)
      spinTimerRef.current = null

      if (isFree) {
        const nextLeft = (bonus?.left ?? 1) - 1
        const nextBank = (bonus?.bank ?? 0) + outcome.win
        const kind = bonus?.kind ?? 'saburo'
        if (nextLeft <= 0) {
          setBonus(null)
          setStatus(nextBank > 0
            ? kind === 'aurore'
              ? `ВЗЛОМ ЗАВЕРШЁН. ФРИСПИНЫ +${nextBank} эдди.`
              : `ИМПЕРИЯ ОТПУСТИЛА. ФРИСПИНЫ +${nextBank} эдди.`
            : kind === 'aurore'
              ? 'ВЗЛОМ ЗАВЕРШЁН. Фриспины без выплаты.'
              : 'ИМПЕРИЯ ОТПУСТИЛА. Фриспины без выплаты.')
        } else {
          setBonus(current => current
            ? { ...current, left: nextLeft, bank: nextBank }
            : current)
          setStatus(outcome.win > 0
            ? `${outcome.label}  +${outcome.win}  // FREE ${bonus!.of - nextLeft}/${bonus!.of}`
            : `NO PAYOUT  // FREE ${bonus!.of - nextLeft}/${bonus!.of}`)
        }
        return
      }

      if (outcome.freeSpins > 0 && reelCount === 5) {
        setBonus({
          left: outcome.freeSpins,
          of: outcome.freeSpins,
          bank: 0,
          kind: outcome.bonusKind ?? 'saburo',
        })
        setStatus(outcome.win > 0
          ? `${outcome.label}  +${outcome.win}`
          : outcome.label)
        return
      }
      setStatus(outcome.win > 0 ? `${outcome.label}  +${outcome.win}` : outcome.label)
    }, settleMs)
  }, [bet, bonus, credits, onSpinningChange, persistCredits, reelCount, spinning])

  useEffect(() => {
    if (spinning || quizBusy || reelCount !== 5) return
    if (!bonus || bonus.left <= 0) return
    const id = window.setTimeout(() => spin('free'), 1250)
    return () => window.clearTimeout(id)
  }, [bonus, quizBusy, reelCount, spin, spinning])

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!active || quizBusy) return
      if (event.code !== 'Space' && event.key !== 'Enter') return
      event.preventDefault()
      if (bonus && bonus.left > 0) spin('free')
      else spin('paid')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, quizBusy, spin])

  const awardQuizEddies = (amount: number) => {
    setCredits(current => {
      const next = current + amount
      persistCredits(next)
      return next
    })
    setStatus(`Контракт закрыт. +${amount} эдди.`)
  }

  const reboot = () => {
    if (spinning || refillLocked || inFreeSpins) return
    setCredits(current => {
      const next = current + STARTING_EDDIES
      persistCredits(next)
      return next
    })
    setRefillLocked(true)
    localStorage.setItem('cyber-slots-refill-locked', '1')
    setLastWin(0)
    setJackpot(false)
    setHits(new Set())
    setStatus('+5000 эдди. Терминал пополнения заблокирован.')
  }

  const paytable = useMemo(
    () => [...poolFor(reelCount, inFreeSpins, bonus?.kind ?? 'saburo')]
      .filter(symbol => symbol.payout3 > 0)
      .sort((left, right) => right.payout3 - left.payout3),
    [bonus?.kind, inFreeSpins, reelCount],
  )
  const times = overlay ? STOP_MS_AURORE_HACK : stopTimes(reelCount)

  return (
    <div className={`flex w-full flex-col items-center ${reelCount === 5 ? 'max-w-[760px]' : 'max-w-[560px]'}`}>
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        {PRELOAD_SRCS.map(src => (
          <img key={src} src={src} alt="" />
        ))}
      </div>
      {overlay === 'aurore' && createPortal(
        <div className={`cyber-hack-overlay cyber-preset-${preset}`} aria-live="assertive">
          <div className="cyber-hack-scanlines" />
          <div className="cyber-hack-noise" />
          <div className="cyber-hack-slice cyber-hack-slice-a" />
          <div className="cyber-hack-slice cyber-hack-slice-b" />
          <div className="cyber-hack-slice cyber-hack-slice-c" />
          <div className="cyber-hack-panel">
            <div className="cyber-hack-kicker">ICE BREAKER // NETWATCH TRACE</div>
            <div className="cyber-hack-title">ВАС ВЗЛАМЫВАЮТ</div>
            <div className="cyber-hack-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
              <div className="cyber-hack-fill" />
            </div>
          </div>
        </div>,
        document.body,
      )}
      {overlay === 'arasaka' && createPortal(
        <div className="cyber-arasaka-overlay" aria-live="assertive">
          <div className="cyber-arasaka-grid" />
          <div className="cyber-arasaka-scan" />
          <div className="cyber-arasaka-stamp">荒坂</div>
          <div className="cyber-arasaka-panel">
            <div className="cyber-arasaka-kicker">ARASAKA CORPORATION // CLASSIFIED</div>
            <div className="cyber-arasaka-title">EMPEROR PROTOCOL</div>
            <div className="cyber-arasaka-sub">SABURO ARASAKA // NEURAL UPLINK</div>
            <div className="cyber-arasaka-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
              <div className="cyber-arasaka-fill" />
            </div>
          </div>
        </div>,
        document.body,
      )}
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <div className="cyber-accent-text flex items-center gap-2">
          <Coins className="h-5 w-5" />
          <span className="font-bold tracking-widest">
            {inFreeSpins
              ? bonus?.kind === 'aurore' ? 'AURORE BREACH' : 'EMPEROR FREESPINS'
              : 'AFTERLIFE REELS'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NightCityContracts
            disabled={spinning || inFreeSpins}
            onAward={awardQuizEddies}
            onBusyChange={setQuizBusy}
          />
          <button
            onClick={reboot}
            disabled={spinning || refillLocked || inFreeSpins}
            className="cyber-btn-accent inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" /> ПОПОЛНИТЬ
          </button>
        </div>
      </div>

      <div className={`cyber-slots relative w-full border-2 p-4 ${jackpot ? 'is-jackpot' : ''} ${lastWin > 0 && !spinning ? 'is-win' : ''} ${inFreeSpins ? 'is-freespin' : ''} ${bonus?.kind === 'aurore' ? 'is-aurore-bonus' : ''} ${overlay ? 'is-hacking' : ''} ${overlay === 'arasaka' ? 'is-arasaka' : ''}`}>
        {bonus && (
          <div className="cyber-freespin-banner">
            {bonus.kind === 'aurore' ? 'BREACH' : 'FREE'} {bonus.of - bonus.left + (spinning ? 1 : 0)}/{bonus.of}
          </div>
        )}
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
                      style={{
                        height: SYMBOL_SIZE,
                        width: '100%',
                        backgroundImage: `url(${symbolSrc(symbol)})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
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
          <div className="flex flex-wrap items-center gap-2">
            {BETS.map(value => (
              <button
                key={value}
                disabled={spinning || inFreeSpins}
                onClick={() => selectPresetBet(value)}
                className={`border px-2.5 py-1.5 font-mono text-xs font-bold ${
                  customBet === '' && bet === value ? 'cyber-btn-accent' : 'cyber-btn-line'
                } disabled:opacity-40`}
              >
                {value}
              </button>
            ))}
            <label className={`flex items-center gap-1.5 border px-2 py-1 ${
              customBet !== '' ? 'cyber-btn-accent' : 'cyber-btn-line'
            }`}>
              <span className="text-[10px] font-black tracking-widest">СВОЯ</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={7}
                disabled={spinning || inFreeSpins}
                value={customBet}
                onChange={event => onCustomBetChange(event.target.value)}
                onBlur={onCustomBetBlur}
                placeholder="ставка"
                aria-label="Своя ставка"
                className="cyber-input w-16 border-0 bg-transparent p-0 font-mono text-xs outline-none disabled:opacity-40"
              />
            </label>
          </div>
          <button
            onClick={() => spin('paid')}
            disabled={spinning || inFreeSpins || credits < bet}
            className="cyber-slots-spin border px-8 py-2.5 text-sm font-black tracking-[.25em] disabled:opacity-40"
          >
            {spinning ? 'SPIN...' : inFreeSpins ? 'FREE' : 'SPIN'}
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
            {!inFreeSpins && (
              <>
                <div className="cyber-text mt-3 mb-1 font-bold">SABURO ARASAKA</div>
                <div className="cyber-muted">
                  Редкий символ. Линия из пяти Saburo (горизонт или длинная диагональ) — 10 фриспинов, не реже чем раз в 180 спинов. Ставка не списывается. Барабаны на время бонуса: Bryce Mosley, Spider Murphy, Placide, Mama Brigitte, Royce, David Martinez, Lucy.
                </div>
                <div className="cyber-text mt-3 mb-1 font-bold">AURORE CASSEL</div>
                <div className="cyber-muted">
                  С небольшим шансом (не реже чем раз в 70 спинов) Аврора заполняет все ячейки и запускает взлом — 5 фриспинов. Барабаны бонуса: Regina Jones, Padre, Skye, Saul Bright, Jefferson Peralez, Mr. Blue Eyes, Aurore Cassel.
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
              </>
            )}
            {inFreeSpins && (
              <div className="cyber-text mt-3">
                {bonus?.kind === 'aurore'
                  ? 'Фриспины Авроры: фиксеры, куклы и призраки Найт-Сити. Выплаты идут по текущей ставке.'
                  : 'Фриспины императора: экипаж Edgerunners и Pacifica. Выплаты идут по текущей ставке.'}
              </div>
            )}
            <div className="mt-2">
              Пробел или Enter — крутить. Сеты из трёх и больше собираются по горизонтали, вертикали и диагонали. Сработавшая линия подсвечивается. Сюжетные связки считаются только на полной линии из пяти.
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
