'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Gamepad2, MessageSquare, RotateCcw, Send, Trophy, UserRound } from 'lucide-react'

type Direction = 'left' | 'right' | 'up' | 'down'

interface ChatMessage {
  id: number
  nickname: string
  message: string
  created_at: string
}

const EMPTY_GRID = Array<number>(16).fill(0)

function addTile(grid: number[]): number[] {
  const empty = grid.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0)
  if (empty.length === 0) return grid
  const next = [...grid]
  const index = empty[Math.floor(Math.random() * empty.length)]
  next[index] = Math.random() < 0.9 ? 2 : 4
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
  if (!value) return 'bg-black/35 border-white/5 text-transparent'
  if (value <= 4) return 'bg-[#2a3027] border-[#fcee09]/30 text-[#fcee09]'
  if (value <= 16) return 'bg-[#183d39] border-[#00f0ff]/40 text-[#00f0ff]'
  if (value <= 64) return 'bg-[#4b1637] border-[#ff2a6d]/50 text-[#ff5b91]'
  if (value <= 256) return 'bg-[#5a4105] border-[#fcee09]/60 text-[#fff56a]'
  return 'bg-[#fcee09] border-white text-black shadow-[0_0_24px_rgba(252,238,9,.45)]'
}

export default function Cyberpunk2077() {
  const [grid, setGrid] = useState<number[]>(EMPTY_GRID)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [nickname, setNickname] = useState('V')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [chatError, setChatError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const supabase = useMemo<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createClient(url, key) : null
  }, [])

  const resetGame = useCallback(() => {
    setGrid(newGrid())
    setScore(0)
  }, [])

  useEffect(() => {
    resetGame()
    setBest(Number(localStorage.getItem('cyber-2048-best') ?? 0))
    setNickname(localStorage.getItem('cyber-2077-nickname') || 'V')
  }, [resetGame])

  const move = useCallback((direction: Direction) => {
    setGrid(current => {
      const result = moveGrid(current, direction)
      if (!result.moved) return current
      setScore(previous => {
        const nextScore = previous + result.gained
        setBest(currentBest => {
          const nextBest = Math.max(currentBest, nextScore)
          localStorage.setItem('cyber-2048-best', String(nextBest))
          return nextBest
        })
        return nextScore
      })
      return addTile(result.grid)
    })
  }, [])

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
      return
    }
    let active = true
    supabase
      .from('cyberpunk_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return
        if (error) setChatError(error.message)
        else setMessages((data as ChatMessage[]).reverse())
      })

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
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const cleanNickname = nickname.trim().slice(0, 30)
    const cleanMessage = message.trim().slice(0, 500)
    if (!supabase || !cleanNickname || !cleanMessage) return
    setChatError('')
    const { error } = await supabase
      .from('cyberpunk_messages')
      .insert({ nickname: cleanNickname, message: cleanMessage })
    if (error) setChatError(error.message)
    else setMessage('')
  }

  const gameOver = grid.some(Boolean) && !canMove(grid)
  const won = grid.some(value => value >= 2048)

  return (
    <div className="relative min-h-[calc(100vh-190px)] overflow-hidden rounded-2xl border border-[#fcee09]/35 bg-[#07090d] text-[#e8edf2] shadow-[0_0_60px_rgba(252,238,9,.08)]">
      <div className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,240,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative border-b border-[#fcee09]/30 bg-[#fcee09] px-6 py-4 text-black">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-black tracking-[.45em]">NIGHT CITY // SUBNET</div>
            <h1 className="text-4xl font-black italic tracking-tight">2048 <span className="text-[#d60050]">2077</span></h1>
          </div>
          <div className="font-mono text-xs">CONNECTION: {supabase ? 'ONLINE' : 'OFFLINE'}</div>
        </div>
      </div>

      <div className="relative grid grid-cols-1 xl:grid-cols-[240px_minmax(420px,1fr)_340px] gap-5 p-5">
        <aside className="space-y-4">
          <section className="border border-[#00f0ff]/35 bg-[#07151a]/90 p-4 [clip-path:polygon(0_12px,12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%)]">
            <div className="flex items-center gap-2 text-[#00f0ff] text-xs font-bold tracking-widest mb-3">
              <UserRound className="w-4 h-4" /> ИДЕНТИФИКАТОР
            </div>
            <label className="text-[10px] text-[#8ba5ad]">НИКНЕЙМ</label>
            <input
              value={nickname}
              maxLength={30}
              onChange={event => {
                setNickname(event.target.value)
                localStorage.setItem('cyber-2077-nickname', event.target.value)
              }}
              className="mt-1 w-full border border-[#00f0ff]/40 bg-black/60 px-3 py-2 font-mono text-sm text-[#00f0ff] outline-none focus:border-[#fcee09]"
            />
          </section>

          <section className="border-l-4 border-[#ff2a6d] bg-[#1b0b17]/90 p-4">
            <div className="flex items-center gap-2 text-[#ff5b91] text-xs font-bold tracking-widest">
              <Trophy className="w-4 h-4" /> СТАТИСТИКА
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 font-mono">
              <div><div className="text-[10px] text-[#8ba5ad]">СЧЁТ</div><div className="text-xl text-[#fcee09]">{score}</div></div>
              <div><div className="text-[10px] text-[#8ba5ad]">РЕКОРД</div><div className="text-xl text-[#00f0ff]">{best}</div></div>
            </div>
          </section>

          <section className="border border-white/10 bg-black/40 p-4 text-xs text-[#8ba5ad]">
            <div className="font-bold text-white mb-2">УПРАВЛЕНИЕ</div>
            Стрелки или WASD. Соединяйте одинаковые нейрочипы и доберитесь до 2048.
          </section>
        </aside>

        <main className="flex flex-col items-center">
          <div className="mb-4 flex w-full max-w-[560px] items-center justify-between">
            <div className="flex items-center gap-2 text-[#fcee09]">
              <Gamepad2 className="w-5 h-5" />
              <span className="font-bold tracking-widest">BREACH PROTOCOL</span>
            </div>
            <button onClick={resetGame}
              className="inline-flex items-center gap-2 border border-[#fcee09]/50 bg-[#fcee09]/10 px-3 py-2 text-xs font-bold text-[#fcee09] hover:bg-[#fcee09] hover:text-black">
              <RotateCcw className="w-4 h-4" /> НОВАЯ ИГРА
            </button>
          </div>

          <div className="relative grid aspect-square w-full max-w-[560px] grid-cols-4 gap-3 border-2 border-[#00f0ff]/35 bg-[#03070a]/95 p-3 shadow-[inset_0_0_40px_rgba(0,240,255,.08)]">
            {grid.map((value, index) => (
              <div key={index}
                className={`flex items-center justify-center border text-2xl sm:text-3xl font-black font-mono transition-all duration-100 ${tileStyle(value)}`}>
                {value || 0}
              </div>
            ))}
            {(gameOver || won) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
                <div className="text-3xl font-black text-[#fcee09]">{won ? 'RELIC ACTIVATED' : 'SYSTEM FAILURE'}</div>
                <button onClick={resetGame} className="mt-4 bg-[#fcee09] px-5 py-2 font-bold text-black">ПЕРЕЗАПУСК</button>
              </div>
            )}
          </div>
        </main>

        <aside className="flex min-h-[560px] flex-col border border-[#ff2a6d]/35 bg-[#120811]/90">
          <div className="flex items-center gap-2 border-b border-[#ff2a6d]/30 px-4 py-3 text-[#ff5b91]">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest">GLOBAL CHAT // 2077</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[560px]">
            {messages.length === 0 && (
              <div className="text-center text-xs text-[#8ba5ad] mt-8">
                {supabase ? 'Канал пуст. Оставьте первое сообщение.' : 'Чат ожидает подключения Supabase.'}
              </div>
            )}
            {messages.map(item => (
              <div key={item.id} className="border-l-2 border-[#00f0ff]/50 bg-black/35 px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-bold text-[#00f0ff]">{item.nickname}</span>
                  <span className="text-[9px] text-[#65777d]">
                    {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-1 break-words text-xs leading-relaxed text-[#d5e1e5]">{item.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="border-t border-[#ff2a6d]/30 p-3">
            {chatError && <div className="mb-2 text-[10px] text-[#ff5b91]">{chatError}</div>}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={event => setMessage(event.target.value)}
                maxLength={500}
                placeholder="Сообщение в сеть..."
                disabled={!supabase}
                className="min-w-0 flex-1 border border-[#ff2a6d]/30 bg-black/60 px-3 py-2 text-xs outline-none placeholder:text-[#6b4c61] focus:border-[#00f0ff]"
              />
              <button
                type="submit"
                disabled={!supabase || !nickname.trim() || !message.trim()}
                className="bg-[#ff2a6d] px-3 text-black disabled:opacity-30">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
