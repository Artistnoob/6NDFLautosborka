'use client'

import {
  FormEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Image, { type StaticImageData } from 'next/image'
import {
  Crown, Eraser, Gamepad2, ListOrdered, MessageSquare, RotateCcw, Send, Trophy, UserRound, X,
} from 'lucide-react'
import cyberdemonRank from './cyberdemon-rank.png'
import arasakaRank from './arasaka-rank.png'
import yellowRuneRank from './yellow-rune-rank.png'

type Direction = 'left' | 'right' | 'up' | 'down'

interface ChatMessage {
  id: number
  nickname: string
  message: string
  created_at: string
}

interface LeaderboardEntry {
  id: number
  nickname: string
  score: number
  achieved_at: string
}

type LeaderboardView = 'all-time' | 'monthly'

const EMPTY_GRID = Array<number>(16).fill(0)
const STANDARD_TARGET = 2048
// В классической механике плитки являются степенями двойки, поэтому ближайшая
// достижимая цель к 2 048 000 — 2 097 152 (2048 × 1024).
const ENDLESS_TARGET = 2_097_152
const HACK_SYMBOLS = [
  'BD 55 E9', 'RAM', '0xFF', 'ICE', '01 10', 'ROOT', 'E9', 'BREACH',
  '55 BD', 'SYS', '0101', 'DAEMON', 'FF 1C', 'NET', '7A', 'ACCESS',
  '1C E9', 'V', '1100', 'PING', 'BD', 'PROXY', '0x77', 'UPLOAD',
]

function readableSupabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Нет связи с Supabase. Проверьте Project URL, anon key и доступность проекта.'
  }
  return message
}

function addTile(grid: number[]): number[] {
  const empty = grid.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0)
  if (empty.length === 0) return grid
  const next = [...grid]
  const index = empty[Math.floor(Math.random() * empty.length)]
  next[index] = Math.random() < 0.9 ? 2 : 4
  return next
}

function addCheatTile(grid: number[], direction: 'left' | 'right'): number[] {
  const candidates: { index: number; value: number }[] = []

  for (let row = 0; row < 4; row++) {
    const values = [0, 1, 2, 3].map(column => grid[row * 4 + column])
    if (direction === 'left') {
      let last = -1
      for (let column = 0; column < 4; column++) {
        if (values[column]) last = column
      }
      if (last >= 0 && last < 3 && values[last + 1] === 0) {
        candidates.push({ index: row * 4 + last + 1, value: values[last] })
      }
    } else {
      const first = values.findIndex(Boolean)
      if (first > 0) {
        candidates.push({ index: row * 4 + first - 1, value: values[first] })
      }
    }
  }

  if (candidates.length === 0) return addTile(grid)

  candidates.sort((left, right) => right.value - left.value)
  const next = [...grid]
  next[candidates[0].index] = candidates[0].value
  return next
}

function newGrid(): number[] {
  return addTile(addTile([...EMPTY_GRID]))
}

function mergeLine(line: number[]): { line: number[]; gained: number } {
  const values = line.filter(Boolean)
  const merged: number[] = []
  let gained = 0
  for (let index = 0; index < values.length; index++) {
    if (values[index] === values[index + 1]) {
      const value = values[index] * 2
      merged.push(value)
      gained += value
      index++
    } else {
      merged.push(values[index])
    }
  }
  while (merged.length < 4) merged.push(0)
  return { line: merged, gained }
}

function moveGrid(grid: number[], direction: Direction): { grid: number[]; gained: number; moved: boolean } {
  const next = Array<number>(16).fill(0)
  let gained = 0
  for (let outer = 0; outer < 4; outer++) {
    const source = Array.from({ length: 4 }, (_, inner) => {
      const row = direction === 'up' || direction === 'down' ? inner : outer
      const column = direction === 'up' || direction === 'down' ? outer : inner
      return grid[row * 4 + column]
    })
    const reversed = direction === 'right' || direction === 'down'
    const result = mergeLine(reversed ? [...source].reverse() : source)
    const line = reversed ? result.line.reverse() : result.line
    gained += result.gained
    line.forEach((value, inner) => {
      const row = direction === 'up' || direction === 'down' ? inner : outer
      const column = direction === 'up' || direction === 'down' ? outer : inner
      next[row * 4 + column] = value
    })
  }
  return {
    grid: next,
    gained,
    moved: next.some((value, index) => value !== grid[index]),
  }
}

function canMove(grid: number[]): boolean {
  if (grid.some(value => value === 0)) return true
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const value = grid[row * 4 + column]
      if (column < 3 && value === grid[row * 4 + column + 1]) return true
      if (row < 3 && value === grid[(row + 1) * 4 + column]) return true
    }
  }
  return false
}

function tileStyle(value: number): string {
  if (!value) return 'cyber-tile cyber-tile-empty'
  if (value <= 4) return 'cyber-tile cyber-tile-2'
  if (value <= 16) return 'cyber-tile cyber-tile-16'
  if (value <= 64) return 'cyber-tile cyber-tile-64'
  if (value <= 256) return 'cyber-tile cyber-tile-256'
  return 'cyber-tile cyber-tile-high'
}

function tileTextSize(value: number): string {
  if (value >= 1_000_000) return 'text-[10px] sm:text-sm'
  if (value >= 100_000) return 'text-xs sm:text-base'
  if (value >= 10_000) return 'text-sm sm:text-xl'
  return 'text-2xl sm:text-3xl'
}

function RankIcon({ rank }: { rank: number }) {
  const icons: Record<number, {
    image: StaticImageData
    title: string
    glow: string
  }> = {
    1: {
      image: cyberdemonRank,
      title: 'Горящий кибердемон',
      glow: 'animate-pulse',
    },
    2: {
      image: arasakaRank,
      title: 'Арасака',
      glow: '',
    },
    3: {
      image: yellowRuneRank,
      title: 'Золотая киберруна',
      glow: 'opacity-90',
    },
  }
  const icon = icons[rank]
  if (!icon) return <span className="h-8 w-8" aria-hidden="true" />
  return (
    <span
      title={icon.title}
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center ${icon.glow}`}
    >
      <Image
        src={icon.image}
        alt=""
        width={32}
        height={32}
        aria-hidden="true"
        className="absolute h-8 w-8 scale-150 object-contain opacity-90 blur-[5px] mix-blend-screen"
      />
      <Image
        src={icon.image}
        alt={icon.title}
        width={32}
        height={32}
        className="relative h-8 w-8 object-contain brightness-125 contrast-150 mix-blend-screen"
      />
    </span>
  )
}

export default function Cyberpunk2077({
  preset = 'classic',
}: {
  preset?: 'classic' | 'arasaka' | 'silverhand'
}) {
  const [grid, setGrid] = useState<number[]>(EMPTY_GRID)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [nickname, setNickname] = useState('V')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [chatError, setChatError] = useState('')
  const [connectionState, setConnectionState] = useState<'offline' | 'connecting' | 'online' | 'error'>('offline')
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([])
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>('all-time')
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [scoreStatus, setScoreStatus] = useState('')
  const [moveAnimation, setMoveAnimation] = useState<{ direction: Direction; sequence: number } | null>(null)
  const [endlessMode, setEndlessMode] = useState(false)
  const [endlessMilestoneDismissed, setEndlessMilestoneDismissed] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const cheatClicksRef = useRef<number[]>([])
  const cheatActiveRef = useRef(false)

  const supabase = useMemo<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createClient(url, key) : null
  }, [])

  const loadLeaderboards = useCallback(async () => {
    if (!supabase) return
    try {
      const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`
      const [allTimeResult, monthlyResult] = await Promise.all([
        supabase
          .from('cyberpunk_scores')
          .select('*')
          .order('score', { ascending: false })
          .order('achieved_at', { ascending: true })
          .limit(20),
        supabase
          .from('cyberpunk_monthly_scores')
          .select('*')
          .eq('score_month', currentMonth)
          .order('score', { ascending: false })
          .order('achieved_at', { ascending: true })
          .limit(20),
      ])
      if (allTimeResult.error) throw allTimeResult.error
      if (monthlyResult.error) throw monthlyResult.error
      setAllTimeLeaderboard((allTimeResult.data ?? []) as LeaderboardEntry[])
      setMonthlyLeaderboard((monthlyResult.data ?? []) as LeaderboardEntry[])
    } catch (error) {
      setScoreStatus(readableSupabaseError(error))
    }
  }, [supabase])

  const resetGame = useCallback(() => {
    setGrid(newGrid())
    setScore(0)
    setEndlessMode(false)
    setEndlessMilestoneDismissed(false)
    setMoveAnimation(null)
  }, [])

  const resetGameFromButton = useCallback(() => {
    const now = Date.now()
    const recent = cheatClicksRef.current.filter(time => now - time < 800)
    recent.push(now)
    cheatClicksRef.current = recent
    cheatActiveRef.current = recent.length >= 4
    resetGame()
  }, [resetGame])

  useEffect(() => {
    resetGame()
    setBest(Number(localStorage.getItem('cyber-2048-best') ?? 0))
    setNickname(localStorage.getItem('cyber-2077-nickname') || 'V')
  }, [resetGame])

  const move = useCallback((direction: Direction) => {
    if (direction === 'up' || direction === 'down') {
      cheatActiveRef.current = false
      cheatClicksRef.current = []
    }
    setGrid(current => {
      const result = moveGrid(current, direction)
      if (!result.moved) return current
      setMoveAnimation(previous => ({
        direction,
        sequence: (previous?.sequence ?? 0) + 1,
      }))
      setScore(previous => {
        const nextScore = previous + result.gained
        setBest(currentBest => {
          const nextBest = Math.max(currentBest, nextScore)
          localStorage.setItem('cyber-2048-best', String(nextBest))
          return nextBest
        })
        return nextScore
      })
      const useCheat = cheatActiveRef.current && (direction === 'left' || direction === 'right')
      return useCheat ? addCheatTile(result.grid, direction) : addTile(result.grid)
    })
  }, [])

  const startBoardSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const finishBoardSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY))
    if (distance < 32) return

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? 'right' : 'left')
    } else {
      move(deltaY > 0 ? 'down' : 'up')
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const directions: Record<string, Direction | undefined> = {
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
      }
      const direction = directions[event.key]
      if (!direction) return
      event.preventDefault()
      move(direction)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move])

  useEffect(() => {
    if (!supabase) {
      setChatError('Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setConnectionState('offline')
      return
    }
    setConnectionState('connecting')
    let active = true
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('cyberpunk_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
        if (!active) return
        if (error) throw error
        setMessages(((data ?? []) as ChatMessage[]).reverse())
        setChatError('')
      } catch (error) {
        if (!active) return
        setConnectionState('error')
        setChatError(readableSupabaseError(error))
      }
    })()
    void loadLeaderboards()

    const channel = supabase
      .channel('cyberpunk-2077-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cyberpunk_messages' },
        payload => {
          const incoming = payload.new as ChatMessage
          setMessages(current =>
            current.some(item => item.id === incoming.id)
              ? current
              : [...current.slice(-99), incoming],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cyberpunk_scores' },
        () => void loadLeaderboards(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cyberpunk_monthly_scores' },
        () => void loadLeaderboards(),
      )
      .subscribe(status => {
        if (!active) return
        if (status === 'SUBSCRIBED') setConnectionState('online')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionState('error')
      })

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [loadLeaderboards, supabase])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const cleanNickname = nickname.trim().slice(0, 30)
    const cleanMessage = message.trim().slice(0, 500)
    if (!supabase || !cleanNickname || !cleanMessage) return
    setChatError('')
    try {
      const { error } = await supabase
        .from('cyberpunk_messages')
        .insert({ nickname: cleanNickname, message: cleanMessage })
      if (error) throw error
      setMessage('')
    } catch (error) {
      setConnectionState('error')
      setChatError(readableSupabaseError(error))
    }
  }

  const wipeIdentity = async () => {
    const cleanNickname = nickname.trim().slice(0, 30)
    setWiping(true)
    localStorage.removeItem('cyber-2048-best')
    setBest(0)
    resetGame()
    setWipeOpen(false)
    setWiping(false)

    if (!supabase || !cleanNickname) {
      setScoreStatus('Текущий результат и личный рекорд сброшены.')
      return
    }

    try {
      const { error } = await supabase.rpc('erase_cyberpunk_identity', {
        player_nickname: cleanNickname,
      })
      if (!error) await loadLeaderboards()
      setScoreStatus('Текущий результат и личный рекорд сброшены.')
    } catch {
      setScoreStatus('Текущий результат и личный рекорд сброшены.')
    }
  }

  const becomeLegend = async () => {
    const cleanNickname = nickname.trim().slice(0, 30)
    if (!supabase) {
      setScoreStatus('Нет подключения к Supabase.')
      return
    }
    if (!cleanNickname) {
      setScoreStatus('Сначала введите никнейм.')
      return
    }
    if (score <= 0) {
      setScoreStatus('Сначала наберите очки.')
      return
    }
    setScoreStatus('Передача результата...')
    try {
      const { data, error } = await supabase.rpc('submit_cyberpunk_score', {
        player_nickname: cleanNickname,
        player_score: score,
      })
      if (error) throw error
      await loadLeaderboards()
      setLeaderboardView('all-time')
      setLeaderboardOpen(true)
      setScoreStatus(
        typeof data === 'number'
          ? `Результат принят. Место в рейтинге: ${data}.`
          : 'Результат принят, но пока не входит в двадцатку.',
      )
    } catch (error) {
      setScoreStatus(readableSupabaseError(error))
    }
  }

  const gameOver = grid.some(Boolean) && !canMove(grid)
  const standardWon = !endlessMode && grid.some(value => value >= STANDARD_TARGET)
  const endlessMilestoneReached =
    endlessMode &&
    !endlessMilestoneDismissed &&
    grid.some(value => value >= ENDLESS_TARGET)
  const leaderboard =
    leaderboardView === 'monthly' ? monthlyLeaderboard : allTimeLeaderboard
  const leaderboardTitle =
    leaderboardView === 'monthly' ? 'МЕСЯЦ СЛАВЫ' : 'ЛЕГЕНДЫ НАЙТ-СИТИ'

  return (
    <div className={`cyber-game cyber-preset-${preset} relative min-h-[calc(100vh-190px)] overflow-hidden rounded-2xl`}>
      <div className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,240,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="cyber-code-field pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => HACK_SYMBOLS[index % HACK_SYMBOLS.length]).map((symbol, index) => (
          <span
            key={`${symbol}-${index}`}
            className="cyber-code-symbol"
            style={{
              left: `${3 + ((index * 37) % 94)}%`,
              animationDelay: `${-((index * 1.15) % 14)}s`,
              animationDuration: `${8 + (index % 7)}s`,
              fontSize: `${9 + (index % 4) * 2}px`,
            }}
          >
            {symbol}
          </span>
        ))}
        <span className="cyber-rare-word">якушко</span>
      </div>
      <div className="cyber-banner relative border-b px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-black tracking-[.45em]">NIGHT CITY // SUBNET</div>
            <h1 className="text-4xl font-black italic tracking-tight">2048 <span className="cyber-banner-mark">2077</span></h1>
          </div>
          <div className="font-mono text-xs">
            CONNECTION: {{
              offline: 'OFFLINE',
              connecting: 'CONNECTING',
              online: 'ONLINE',
              error: 'ERROR',
            }[connectionState]}
          </div>
        </div>
      </div>

      {leaderboardOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <section className="cyber-leaderboard cyber-panel w-full max-w-xl border">
            <div className="cyber-banner flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2 font-black italic tracking-widest">
                <Trophy className="h-5 w-5" /> {leaderboardTitle}
              </div>
              <button onClick={() => setLeaderboardOpen(false)} aria-label="Закрыть таблицу рекордов">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-4">
              {scoreStatus && (
                <div className="cyber-status mb-3 border-l-2 px-3 py-2 text-xs">
                  {scoreStatus}
                </div>
              )}
              {leaderboard.length === 0 ? (
                <div className="cyber-muted py-12 text-center text-sm">
                  {leaderboardView === 'monthly'
                    ? 'В этом месяце рейтинг пока пуст. Откройте месяц славы первым.'
                    : 'Рейтинг пока пуст. Станьте первой легендой Найт-Сити.'}
                </div>
              ) : (
                <ol className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <li key={entry.id}
                      className={`cyber-rank-row grid grid-cols-[42px_34px_1fr_auto] items-center gap-2 border px-3 py-2 ${
                        index === 0 ? 'is-first' : index < 3 ? 'is-podium' : ''
                      }`}>
                      <span className={`cyber-rank-index text-lg font-black ${index === 0 ? 'is-first' : ''}`}>
                        #{index + 1}
                      </span>
                      <RankIcon rank={index + 1} />
                      <span className={`cyber-rank-name truncate text-sm ${
                        index === 0 ? 'cyber-first-place-name font-bold' : ''
                      }`}>
                        {entry.nickname}
                      </span>
                      <span className="cyber-number text-lg font-black">{entry.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="relative grid grid-cols-1 xl:grid-cols-[240px_minmax(420px,1fr)_340px] gap-5 p-5">
        <aside className="space-y-4">
          <section className="cyber-panel border p-4 [clip-path:polygon(0_12px,12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%)]">
            <div className="cyber-line-text mb-3 flex items-center gap-2 text-xs font-bold tracking-widest">
              <UserRound className="w-4 h-4" /> ИДЕНТИФИКАТОР
            </div>
            <label className="cyber-muted text-[10px]">НИКНЕЙМ</label>
            <input
              value={nickname}
              maxLength={30}
              onChange={event => {
                setNickname(event.target.value)
                localStorage.setItem('cyber-2077-nickname', event.target.value)
              }}
              className="cyber-input mt-1 w-full border bg-black/60 px-3 py-2 font-mono text-sm outline-none"
            />
          </section>

          <section className="cyber-stat-panel border-l-4 p-4">
            <div className="cyber-hot-text flex items-center gap-2 text-xs font-bold tracking-widest">
              <Trophy className="w-4 h-4" /> СТАТИСТИКА
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 font-mono">
              <div><div className="cyber-muted text-[10px]">СЧЁТ</div><div className="cyber-number text-xl">{score}</div></div>
              <div><div className="cyber-muted text-[10px]">РЕКОРД</div><div className="cyber-number text-xl">{best}</div></div>
            </div>
          </section>

          <section className="cyber-help border p-4 text-xs">
            <div className="cyber-text mb-2 font-bold">УПРАВЛЕНИЕ</div>
            Стрелки или WASD. На телефоне управляйте свайпами по игровому полю.
            Соединяйте одинаковые нейрочипы и доберитесь до 2048.
          </section>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => void becomeLegend()}
              className="cyber-btn-accent inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-xs font-black"
            >
              <Crown className="h-4 w-4" /> СТАТЬ ЛЕГЕНДОЙ
            </button>
            <button
              onClick={() => {
                setLeaderboardView('monthly')
                setLeaderboardOpen(true)
                void loadLeaderboards()
              }}
              className="cyber-btn-hot inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-xs font-bold"
            >
              <ListOrdered className="h-4 w-4" /> МЕСЯЦ СЛАВЫ
            </button>
            <button
              onClick={() => {
                setLeaderboardView('all-time')
                setLeaderboardOpen(true)
                void loadLeaderboards()
              }}
              className="cyber-legends-button cyber-btn-line inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-xs font-black"
            >
              <Crown className="h-4 w-4" /> ЛЕГЕНДЫ НАЙТ-СИТИ
            </button>
            {scoreStatus && !leaderboardOpen && (
              <div className="cyber-hot-text text-[10px] leading-relaxed">{scoreStatus}</div>
            )}
          </div>
        </aside>

        <main className="flex flex-col items-center">
          <div className="mb-4 flex w-full max-w-[560px] items-center justify-between">
            <div className="cyber-accent-text flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              <span className="font-bold tracking-widest">BREACH PROTOCOL</span>
              <span className="cyber-muted border-l pl-2 font-mono text-[10px]">
                ЦЕЛЬ: {(endlessMode ? ENDLESS_TARGET : STANDARD_TARGET).toLocaleString('ru-RU')}
              </span>
            </div>
            <button onClick={resetGameFromButton}
              className="cyber-btn-accent inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold">
              <RotateCcw className="w-4 h-4" /> НОВАЯ ИГРА
            </button>
          </div>

          <div
            className="cyber-board relative grid aspect-square w-full max-w-[560px] touch-none select-none grid-cols-4 gap-3 border-2 p-3"
            onTouchStart={startBoardSwipe}
            onTouchEnd={finishBoardSwipe}
            onTouchCancel={() => { touchStartRef.current = null }}
          >
            {grid.map((value, index) => (
              <div
                key={`${index}-${moveAnimation?.sequence ?? 0}`}
                className={`${tileStyle(value)} flex items-center justify-center border font-black font-mono transition-all duration-100 ${
                  moveAnimation ? `cyber-tile-move-${moveAnimation.direction}` : ''
                } ${tileTextSize(value)}`}
              >
                {value || 0}
              </div>
            ))}
            {(gameOver || standardWon || endlessMilestoneReached) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
                <div className="cyber-accent-text px-4 text-center text-3xl font-black">
                  {endlessMilestoneReached
                    ? 'NIGHT CITY LEGEND'
                    : standardWon
                      ? 'RELIC ACTIVATED'
                      : 'SYSTEM FAILURE'}
                </div>
                {endlessMilestoneReached && (
                  <div className="cyber-number mt-2 font-mono text-xs">
                    ПЛИТКА {ENDLESS_TARGET.toLocaleString('ru-RU')} СОБРАНА
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button onClick={resetGameFromButton} className="cyber-banner px-5 py-2 font-bold">
                    ПЕРЕЗАПУСК
                  </button>
                  {standardWon && (
                    <button
                      onClick={() => setEndlessMode(true)}
                      className="cyber-btn-line border px-5 py-2 font-bold"
                    >
                      БЕСКОНЕЧНЫЙ РЕЖИМ
                    </button>
                  )}
                  {endlessMilestoneReached && (
                    <button
                      onClick={() => setEndlessMilestoneDismissed(true)}
                      className="cyber-btn-hot border px-5 py-2 font-bold"
                    >
                      ПРОДОЛЖИТЬ
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="cyber-chat flex min-h-[560px] flex-col border">
          <div className="cyber-chat-header flex items-center gap-2 border-b px-4 py-3">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest">GLOBAL CHAT // 2077</span>
          </div>
          <div className="max-h-[560px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="cyber-muted mt-8 text-center text-xs">
                {supabase ? 'Канал пуст. Оставьте первое сообщение.' : 'Чат ожидает подключения Supabase.'}
              </div>
            )}
            {messages.map(item => (
              <div key={item.id} className="cyber-chat-item border-l-2 bg-black/35 px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="cyber-chat-name text-xs font-bold">{item.nickname}</span>
                  <span className="cyber-muted text-[9px]">
                    {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="cyber-chat-text mt-1 break-words text-xs leading-relaxed">{item.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="cyber-chat-form border-t p-3">
            {chatError && <div className="cyber-hot-text mb-2 text-[10px]">{chatError}</div>}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={event => setMessage(event.target.value)}
                maxLength={500}
                placeholder="Сообщение в сеть..."
                disabled={!supabase}
                className="cyber-chat-input min-w-0 flex-1 border bg-black/60 px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                disabled={!supabase || !nickname.trim() || !message.trim()}
                className="cyber-send px-3 disabled:opacity-30">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>

      <button
        onClick={() => setWipeOpen(true)}
        className="cyber-btn-hot absolute bottom-4 left-4 z-20 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8px] font-black tracking-widest"
      >
        <Eraser className="h-2.5 w-2.5" /> ОБНУЛИТЬСЯ
      </button>

      {wipeOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <section className="cyber-panel w-full max-w-md border p-5">
            <div className="cyber-hot-text text-sm font-black tracking-widest">ПРЕДУПРЕЖДЕНИЕ</div>
            <p className="cyber-text mt-3 text-sm leading-relaxed">
              Это сбросит весь ваш текущий результат и сотрёт его из истории.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setWipeOpen(false)}
                disabled={wiping}
                className="cyber-btn-line border px-4 py-2 text-xs font-bold"
              >
                Нет
              </button>
              <button
                onClick={() => void wipeIdentity()}
                disabled={wiping}
                className="cyber-btn-hot border px-4 py-2 text-xs font-black"
              >
                {wiping ? 'Сброс...' : 'Да, я уверен'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
