'use client'

import { useState, useCallback, useRef } from 'react'
import {
  FileText, Bell, Zap, RotateCcw, Download, X, CheckCircle2,
  Info, ChevronRight, Loader2
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string
  file: File
}

interface LogEntry {
  time: string
  text: string
  type: 'ok' | 'err' | 'info' | 'warn'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}
function plural(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return ''
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'а'
  return 'ов'
}
function nowTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DropZone({
  label, hint, icon: Icon, onFiles
}: {
  label: string, hint: string, icon: React.ElementType, onFiles: (f: File[]) => void
}) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback((files: FileList | null) => {
    if (!files) return
    onFiles([...files].filter(f => f.name.endsWith('.xml')))
  }, [onFiles])

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files) }}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer select-none
        transition-all duration-200
        ${drag
          ? 'border-accent bg-accent/10'
          : 'border-border-hi hover:border-accent hover:bg-accent/5'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        multiple
        className="hidden"
        onChange={e => handle(e.target.files)}
        onClick={e => e.stopPropagation()}
      />
      <Icon className={`w-8 h-8 mx-auto mb-3 transition-colors ${drag ? 'text-accent' : 'text-muted'}`} />
      <p className="text-sm text-muted">
        <span className="text-accent-hi font-medium">Нажмите или перетащите</span> {label}
      </p>
      <p className="text-xs text-muted mt-1 font-mono">{hint}</p>
    </div>
  )
}

function FileItem({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-bg border border-border rounded-lg px-3 py-2.5 animate-slide-up">
      <FileText className="w-4 h-4 text-accent flex-shrink-0" />
      <span className="flex-1 font-mono text-xs text-[#e8e9f0] truncate" title={name}>{name}</span>
      <span className="text-xs text-muted font-mono flex-shrink-0">{fmtSize(size)}</span>
      <button
        onClick={onRemove}
        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function StepCard({
  number, title, desc, status, badge, children
}: {
  number: string
  title: string
  desc: string
  status: 'idle' | 'active' | 'done'
  badge: string
  children: React.ReactNode
}) {
  const borderColor = {
    idle:   'border-border',
    active: 'border-accent',
    done:   'border-success',
  }[status]

  const numBg = {
    idle:   'bg-border border-border-hi text-muted',
    active: 'bg-accent/10 border-accent text-accent-hi',
    done:   'bg-success/10 border-success text-success',
  }[status]

  const badgeStyle = {
    idle:   'bg-border text-muted',
    active: 'bg-accent/10 text-accent-hi',
    done:   'bg-success/10 text-success',
  }[status]

  return (
    <div className={`bg-surface border ${borderColor} rounded-xl overflow-hidden transition-colors duration-300`}>
      <div className="flex items-center gap-4 px-6 py-5">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-medium flex-shrink-0 transition-all duration-300 ${numBg}`}>
          {status === 'done' ? <CheckCircle2 className="w-4 h-4" /> : number}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[15px]">{title}</div>
          <div className="text-xs text-muted mt-0.5">{desc}</div>
        </div>
        <div className={`text-xs font-mono px-2.5 py-1 rounded-full ${badgeStyle}`}>{badge}</div>
      </div>
      <div className="px-6 pb-6 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function LogLine({ entry }: { entry: LogEntry }) {
  const colors = {
    ok:   'text-success',
    err:  'text-danger',
    info: 'text-accent-hi',
    warn: 'text-warning',
  }
  return (
    <div className="flex gap-3 font-mono text-xs leading-relaxed">
      <span className="text-muted flex-shrink-0">{entry.time}</span>
      <span className={colors[entry.type]}>{entry.text}</span>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [notifs,  setNotifs]  = useState<UploadedFile[]>([])
  const [reports, setReports] = useState<UploadedFile[]>([])
  const [logs,    setLogs]    = useState<LogEntry[]>([])
  const [processed, setProcessed] = useState(false)
  const [running, setRunning] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const next = [...prev, { time: nowTime(), text, type }]
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      return next
    })
  }, [])

  const addFiles = (key: 'notifs' | 'reports', files: File[]) => {
    const setter = key === 'notifs' ? setNotifs : setReports
    setter(prev => {
      const existingKeys = new Set(prev.map(f => f.file.name + f.file.size))
      const fresh = files.filter(f => !existingKeys.has(f.name + f.size))
      return [...prev, ...fresh.map(f => ({ id: uid(), file: f }))]
    })
    setProcessed(false)
  }

  const removeFile = (key: 'notifs' | 'reports', id: string) => {
    const setter = key === 'notifs' ? setNotifs : setReports
    setter(prev => prev.filter(f => f.id !== id))
    setProcessed(false)
  }

  const reset = () => {
    setNotifs([])
    setReports([])
    setLogs([])
    setProcessed(false)
  }

  // Основная функция запуска
  const run = async () => {
  setRunning(true)
  setLogs([])

  addLog(`Запуск обработки: ${reports.length} отчёт(ов)...`, 'info')

  const formData = new FormData()
  notifs.forEach(f => formData.append('notifications', f.file))
  reports.forEach(f => formData.append('reports', f.file))

  try {
    const res = await fetch('/api/process-reports', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const json = await res.json() as { files: { name: string; data: string }[] }

      // Скачиваем каждый файл по отдельности
      for (const { name, data } of json.files) {
        const byteArray = Uint8Array.from(atob(data), c => c.charCodeAt(0))
        const blob = new Blob([byteArray], { type: 'application/xml' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        addLog(`✓ Скачан: ${name}`, 'ok')
      }

      setProcessed(true)
    } else {
      const err = await res.json()
      addLog(`✗ Ошибка сервера: ${err.error || 'Неизвестная ошибка'}`, 'err')
    }
  } catch (e: any) {
    addLog(`✗ Ошибка сети: ${e.message}`, 'err')
  } finally {
    setRunning(false)
  }
}

  const ready = notifs.length > 0 && reports.length > 0 && !running

  const step1Status = notifs.length > 0 ? 'done' : 'active'
  const step2Status = reports.length > 0 ? 'done' : notifs.length > 0 ? 'active' : 'idle'
  const step3Status = processed ? 'done' : (ready || running) ? 'active' : 'idle'

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center font-mono text-sm font-medium text-white flex-shrink-0">
            НД
          </div>
          <div>
            <div className="font-semibold text-[15px] leading-none">6-НДФЛ Updater</div>
            <div className="text-xs text-muted mt-0.5">Обновление отчётов по уведомлениям</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Обновление отчётов</h1>
          <p className="text-muted text-sm">
            Загрузите уведомления и отчёты — система заполнит строки 021–026, 140, 160, 131, 120 по каждому КБК
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <StepCard
            number="1" title="Уведомления" status={step1Status}
            desc="XML-файлы уведомлений об исчисленных суммах налога"
            badge={notifs.length > 0 ? `${notifs.length} файл${plural(notifs.length)}` : '0 файлов'}
          >
            <DropZone
              label="XML-уведомления"
              hint="*.xml • несколько файлов"
              icon={Bell}
              onFiles={f => addFiles('notifs', f)}
            />
            {notifs.length > 0 && (
              <div className="flex flex-col gap-2">
                {notifs.map(f => (
                  <FileItem key={f.id} name={f.file.name} size={f.file.size}
                    onRemove={() => removeFile('notifs', f.id)} />
                ))}
              </div>
            )}
          </StepCard>

          <div className="flex justify-center">
            <ChevronRight className="w-5 h-5 text-border-hi rotate-90" />
          </div>

          <StepCard
            number="2" title="Отчёты 6-НДФЛ" status={step2Status}
            desc="XML-файлы отчётов, которые нужно обновить"
            badge={reports.length > 0 ? `${reports.length} файл${plural(reports.length)}` : '0 файлов'}
          >
            <DropZone
              label="XML-отчёты 6-НДФЛ"
              hint="*.xml • несколько файлов"
              icon={FileText}
              onFiles={f => addFiles('reports', f)}
            />
            {reports.length > 0 && (
              <div className="flex flex-col gap-2">
                {reports.map(f => (
                  <FileItem key={f.id} name={f.file.name} size={f.file.size}
                    onRemove={() => removeFile('reports', f.id)} />
                ))}
              </div>
            )}
          </StepCard>

          <div className="flex justify-center">
            <ChevronRight className="w-5 h-5 text-border-hi rotate-90" />
          </div>

          <StepCard
            number="3" title="Собрать отчёты" status={step3Status}
            desc="Заполнить строки и скачать обновлённый XML-файл"
            badge={
              running ? 'обработка...'
              : processed ? 'скачано'
              : ready ? 'готово к запуску'
              : 'ожидание'
            }
          >
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={run}
                disabled={!ready}
                className={`
                  inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${ready
                    ? 'bg-accent text-white hover:bg-accent-hi hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30'
                    : 'bg-border text-muted cursor-not-allowed opacity-50'
                  }
                `}
              >
                {running
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Обработка...</>
                  : <><Zap className="w-4 h-4" /> Собрать и скачать</>
                }
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-border text-[#e8e9f0] hover:bg-border-hi transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Сбросить
              </button>
            </div>

            {logs.length > 0 && (
              <div className="bg-bg border border-border rounded-xl p-4 max-h-64 overflow-y-auto">
                {logs.map((e, i) => <LogLine key={i} entry={e} />)}
                <div ref={logEndRef} />
              </div>
            )}
          </StepCard>
        </div>

        <div className="mt-8 flex gap-3 p-4 bg-surface border border-border rounded-xl">
          <Info className="w-4 h-4 text-accent-hi flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            Обработка XML происходит на сервере. Система конвертирует результат в кодировку Windows-1251 для корректной работы с ПО ФНС.
          </p>
        </div>
      </main>
    </div>
  )
}