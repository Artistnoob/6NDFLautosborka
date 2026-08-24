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

const SYMBOL_SIZE = 112
const STRIP_LENGTH = 28
const LAND_INDEX = 24
const STARTING_EDDIES = 500
const BETS = [10, 25, 50, 100] as const
const REEL_STOP_MS = [1400, 2100, 2800] as const

interface SlotSymbol {
  id: string
  name: string
  image: StaticImageData
  weight: number
  payout3: number
  payout2: number
}

const SYMBOLS: SlotSymbol[] = [
  { id: 'v', name: 'V', image: slotV, weight: 18, payout3: 8, payout2: 1 },
  { id: 'jackie', name: 'Jackie', image: slotJackie, weight: 16, payout3: 10, payout2: 1 },
  { id: 'judy', name: 'Judy', image: slotJudy, weight: 14, payout3: 12, payout2: 2 },
  { id: 'panam', name: 'Panam', image: slotPanam, weight: 12, payout3: 15, payout2: 2 },
  { id: 'rogue', name: 'Rogue', image: slotRogue, weight: 10, payout3: 20, payout2: 2 },
  { id: 'alt', name: 'Alt', image: slotAlt, weight: 8, payout3: 30, payout2: 3 },
  { id: 'johnny', name: 'Johnny', image: slotJohnny, weight: 6, payout3: 50, payout2: 4 },
  { id: 'smasher', name: 'Smasher', image: slotSmasher, weight: 4, payout3: 100, payout2: 5 },
]

function pickSymbol(): SlotSymbol {
  const total = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0)
  let roll = Math.random() * total
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight
    if (roll <= 0) return symbol
  }
  return SYMBOLS[0]
}

function buildStrip(result: SlotSymbol): SlotSymbol[] {
  const strip = Array.from({ length: STRIP_LENGTH }, () => pickSymbol())
  strip[LAND_INDEX] = result
  return strip
}

function evaluate(results: SlotSymbol[], bet: number): { win: number; label: string; jackpot: boolean } {
  const [left, center, right] = results
  if (left.id === center.id && center.id === right.id) {
    return {
      win: bet * left.payout3,
      label: `ТРИ ${left.name.toUpperCase()}`,
      jackpot: left.payout3 >= 50,
    }
  }
  if (left.id === center.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false }
  }
  if (center.id === right.id) {
    return { win: bet * center.payout2, label: `ПАРА // ${center.name}`, jackpot: false }
  }
  if (left.id === right.id) {
    return { win: bet * left.payout2, label: `ПАРА // ${left.name}`, jackpot: false }
  }
  return { win: 0, label: 'NO PAYOUT', jackpot: false }
}

function reelOffset(index: number): number {
  return -(index - 1) * SYMBOL_SIZE
}

export default function NightCitySlots({
  active = true,
}: {
  active?: boolean
}) {
  const [credits, setCredits] = useState(STARTING_EDDIES)
  const [best, setBest] = useState(STARTING_EDDIES)
  const [bet, setBet] = useState<(typeof BETS)[number]>(25)
  const [strips, setStrips] = useState<SlotSymbol[][]>(() => [
    buildStrip(pickSymbol()),
    buildStrip(pickSymbol()),
    buildStrip(pickSymbol()),
  ])
  const [offsets, setOffsets] = useState(() => [
    reelOffset(LAND_INDEX),
    reelOffset(LAND_INDEX),
    reelOffset(LAND_INDEX),
  ])
  const [armed, setArmed] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [status, setStatus] = useState('Вставьте эдди и крутите барабаны.')
  const [lastWin, setLastWin] = useState(0)
  const [jackpot, setJackpot] = useState(false)
  const spinTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const storedCredits = Number(localStorage.getItem('cyber-slots-credits') ?? STARTING_EDDIES)
    const storedBest = Number(localStorage.getItem('cyber-slots-best') ?? storedCredits)
    setCredits(Number.isFinite(storedCredits) ? Math.max(0, storedCredits) : STARTING_EDDIES)
    setBest(Number.isFinite(storedBest) ? Math.max(0, storedBest) : STARTING_EDDIES)
  }, [])

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

    const nextCredits = credits - bet
    const results = [pickSymbol(), pickSymbol(), pickSymbol()]
    const outcome = evaluate(results, bet)
    const nextStrips = results.map(result => buildStrip(result))

    setCredits(nextCredits)
    persistCredits(nextCredits)
    setLastWin(0)
    setJackpot(false)
    setStatus('БАРАБАНЫ ВРАЩАЮТСЯ...')
    setSpinning(true)
    setArmed(false)
    setStrips(nextStrips)
    setOffsets([0, 0, 0])

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArmed(true)
        setOffsets([
          reelOffset(LAND_INDEX),
          reelOffset(LAND_INDEX),
          reelOffset(LAND_INDEX),
        ])
      })
    })

    if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current)
    spinTimerRef.current = window.setTimeout(() => {
      const finalCredits = nextCredits + outcome.win
      setCredits(finalCredits)
      persistCredits(finalCredits)
      setLastWin(outcome.win)
      setJackpot(outcome.jackpot)
      setStatus(outcome.win > 0 ? `${outcome.label}  +${outcome.win}` : outcome.label)
      setSpinning(false)
      spinTimerRef.current = null
    }, REEL_STOP_MS[2] + 80)
  }, [bet, credits, persistCredits, spinning])

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
    setStatus('Счётчик эдди перезагружен.')
  }

  const paytable = useMemo(
    () => [...SYMBOLS].sort((left, right) => right.payout3 - left.payout3),
    [],
  )

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center">
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
          {Array.from({ length: 13 }, (_, index) => (
            <span key={index} className="cyber-slots-light" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>

        <div className="cyber-slots-window relative grid grid-cols-3 gap-2 border p-2">
          <div className="cyber-payline pointer-events-none absolute inset-x-2 z-10" />
          {strips.map((strip, reelIndex) => (
            <div key={reelIndex} className="cyber-reel relative overflow-hidden">
              <div
                className={`cyber-reel-strip ${armed ? 'is-armed' : ''} ${spinning ? 'is-spinning' : ''}`}
                style={{
                  transform: `translateY(${offsets[reelIndex]}px)`,
                  transitionDuration: armed ? `${REEL_STOP_MS[reelIndex]}ms` : '0ms',
                }}
              >
                {strip.map((symbol, symbolIndex) => (
                  <div
                    key={`${reelIndex}-${symbolIndex}`}
                    className="cyber-reel-cell relative overflow-hidden border"
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
                  </div>
                ))}
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {paytable.map(symbol => (
            <div key={symbol.id} className="flex items-center justify-between gap-2">
              <span>{symbol.name}</span>
              <span className="cyber-number font-mono">3×{symbol.payout3} / 2×{symbol.payout2}</span>
            </div>
          ))}
        </div>
        <div className="mt-2">Пробел или Enter — крутить. Три одинаковых персонажа дают джекпот.</div>
      </section>
    </div>
  )
}
