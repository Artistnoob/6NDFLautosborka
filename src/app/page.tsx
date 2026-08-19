'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import {
  FileText, Bell, Zap, RotateCcw, X, CheckCircle2,
  Info, ChevronRight, Loader2, History, Calendar, CalendarRange, Scale
} from 'lucide-react'
import NdflReconciliation from '@/app/NdflReconciliation'
import Cyberpunk2077 from '@/app/Cyberpunk2077'
import PalettePicker, {
  DEFAULT_SECTION_PALETTES,
  sectionFilter,
  type PaletteSection,
  type SectionPalette,
  type SectionPalettes,
} from '@/app/PalettePicker'
import {
  ALL_MATCH_FIELDS,
  MATCH_FIELD_LABELS,
  type MatchField,
} from '@/lib/matching'

type ReportMode = 'reconciliation' | 'quarterly' | 'annual' | 'cyberpunk'
type CyberPreset = 'classic' | 'arasaka' | 'silverhand'
type FileBucket = 'notifs' | 'reports' | 'prevReports'

const CYBER_PRESETS: Record<CyberPreset, {
  label: string
  description: string
}> = {
  classic: {
    label: 'Классика Найт-Сити',
    description: 'Жёлтый, бирюзовый и неоново-розовый',
  },
  arasaka: {
    label: 'Арасака',
    description: 'Чёрный фон, красные контуры, голубые цифры и чат',
  },
  silverhand: {
    label: 'Сильверхэнд',
    description: 'Светло-синие надписи с неоновой обводкой'
  },
}

interface UploadedFile {
  id: string
  file: File
}

interface LogEntry {
  time: string
  text: string
  type: 'ok' | 'err' | 'info' | 'warn'
}

interface AnnualTaxIssue {
  personKey: string
  inn: string
  fullName: string
  originalTotal: number
  calculatedTotal: number
  requestedTotal: number
  remainingDiff: number
  reportCount: number
  targetValue: string
  fixed: boolean
}

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

function DropZone({
  label, hint, icon: Icon, onFiles, annual = false,
}: {
  label: string
  hint: string
  icon: React.ElementType
  onFiles: (f: File[]) => void
  annual?: boolean
}) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback((files: FileList | null) => {
    if (!files) return
    onFiles([...files].filter(f => f.name.endsWith('.xml')))
  }, [onFiles])

  const dragCls = annual
    ? 'border-annual-accent bg-annual-accent/10'
    : 'border-accent bg-accent/10'
  const idleCls = annual
    ? 'border-annual-border-hi hover:border-annual-accent hover:bg-annual-accent/5'
    : 'border-border-hi hover:border-accent hover:bg-accent/5'

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files) }}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer select-none transition-all duration-200 ${drag ? dragCls : idleCls}`}
    >
      <input ref={inputRef} type="file" accept=".xml" multiple className="hidden"
        onChange={e => handle(e.target.files)} onClick={e => e.stopPropagation()} />
      <Icon className={`w-8 h-8 mx-auto mb-3 transition-colors ${drag ? (annual ? 'text-annual-accent' : 'text-accent') : 'text-muted'}`} />
      <p className="text-sm text-muted">
        <span className={`font-medium ${annual ? 'text-annual-accent-hi' : 'text-accent-hi'}`}>Нажмите или перетащите</span> {label}
      </p>
      <p className="text-xs text-muted mt-1 font-mono">{hint}</p>
    </div>
  )
}

function FileItem({ name, size, onRemove, annual = false }: { name: string; size: number; onRemove: () => void; annual?: boolean }) {
  return (
    <div className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 animate-slide-up ${annual ? 'bg-annual-bg border-annual-border' : 'bg-bg border-border'}`}>
      <FileText className={`w-4 h-4 flex-shrink-0 ${annual ? 'text-annual-accent' : 'text-accent'}`} />
      <span className="flex-1 font-mono text-xs text-[#e8e9f0] truncate" title={name}>{name}</span>
      <span className="text-xs text-muted font-mono flex-shrink-0">{fmtSize(size)}</span>
      <button onClick={onRemove} className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function StepCard({
  number, title, desc, status, badge, children, annual = false,
}: {
  number: string; title: string; desc: string
  status: 'idle' | 'active' | 'done'; badge: string
  children: React.ReactNode; annual?: boolean
}) {
  const borderColor = { idle: annual ? 'border-annual-border' : 'border-border', active: annual ? 'border-annual-accent' : 'border-accent', done: 'border-success' }[status]
  const numBg = {
    idle: annual ? 'bg-annual-border border-annual-border-hi text-muted' : 'bg-border border-border-hi text-muted',
    active: annual ? 'bg-annual-accent/10 border-annual-accent text-annual-accent-hi' : 'bg-accent/10 border-accent text-accent-hi',
    done: 'bg-success/10 border-success text-success',
  }[status]
  const badgeStyle = {
    idle: annual ? 'bg-annual-border text-muted' : 'bg-border text-muted',
    active: annual ? 'bg-annual-accent/10 text-annual-accent-hi' : 'bg-accent/10 text-accent-hi',
    done: 'bg-success/10 text-success',
  }[status]

  return (
    <div className={`border ${borderColor} rounded-xl overflow-hidden transition-colors duration-300 ${annual ? 'bg-annual-surface' : 'bg-surface'}`}>
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

function ExcludePanel({ excluded, onToggle, annual = false }: { excluded: Set<MatchField>; onToggle: (field: MatchField) => void; annual?: boolean }) {
  return (
    <aside className={`fixed top-28 left-4 z-20 w-52 border rounded-xl p-4 shadow-lg hidden lg:block ${annual ? 'bg-annual-surface border-annual-border' : 'bg-surface border-border'}`}>
      <div className="text-xs font-semibold text-[#e8e9f0] mb-3">Исключить для заполнения</div>
      <div className="flex flex-col gap-2">
        {ALL_MATCH_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-[#e8e9f0] transition-colors">
            <input type="checkbox" checked={excluded.has(field)} onChange={() => onToggle(field)}
              className={`rounded border-border-hi ${annual ? 'accent-annual-accent' : 'accent-accent'}`} />
            <span>{MATCH_FIELD_LABELS[field]}</span>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-muted mt-3 leading-relaxed">
        {annual
          ? 'Отмеченные поля не участвуют в сопоставлении отчётов с уведомлениями.'
          : 'Отмеченные поля не участвуют в сопоставлении отчётов с уведомлениями. На отчёты прошлого периода не влияет.'}
      </p>
    </aside>
  )
}

function LogLine({ entry }: { entry: LogEntry }) {
  const colors = { ok: 'text-success', err: 'text-danger', info: 'text-accent-hi', warn: 'text-warning' }
  return (
    <div className="flex gap-3 font-mono text-xs leading-relaxed">
      <span className="text-muted flex-shrink-0">{entry.time}</span>
      <span className={colors[entry.type]}>{entry.text}</span>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: ReportMode; onChange: (m: ReportMode) => void }) {
  const btn = (m: ReportMode, label: string, Icon: React.ElementType) => {
    const active = mode === m
    const annualActive = m === 'annual' && active
    const reconciliationActive = m === 'reconciliation' && active
    return (
      <button
        onClick={() => onChange(m)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          reconciliationActive
            ? 'bg-[#009b79] text-[#001f18] shadow-md shadow-[#009b79]/20'
            : annualActive
            ? 'bg-annual-accent text-white shadow-lg shadow-annual-accent/30'
            : active
              ? 'bg-accent text-white shadow-lg shadow-accent/30'
              : 'bg-border/60 text-muted hover:text-[#e8e9f0]'
        }`}
      >
        <Icon className="w-4 h-4" /> {label}
      </button>
    )
  }
  return (
    <div className="flex gap-2 flex-wrap">
      {btn('reconciliation', 'Сверка НДФЛ', Scale)}
      {btn('quarterly', 'Квартальная отчётность', Calendar)}
      {btn('annual', 'Годовая отчётность', CalendarRange)}
    </div>
  )
}

async function downloadZip(files: { name: string; data?: string; error?: string }[], prefix: string) {
  const zip = new JSZip()
  let successCount = 0
  for (const item of files) {
    if (!item.data) continue
    const byteArray = Uint8Array.from(atob(item.data), c => c.charCodeAt(0))
    zip.file(item.name, byteArray)
    successCount += 1
  }
  if (successCount === 0) return 0
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = window.URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${Date.now()}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
  return successCount
}

function downloadBlob(blob: Blob, name: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function Home() {
  const [mode, setMode] = useState<ReportMode>('quarterly')
  const [sectionPalettes, setSectionPalettes] = useState<SectionPalettes>(DEFAULT_SECTION_PALETTES)
  const [cyberPreset, setCyberPreset] = useState<CyberPreset>('classic')
  const [cyberPresetsOpen, setCyberPresetsOpen] = useState(false)

  const [notifs, setNotifs] = useState<UploadedFile[]>([])
  const [reports, setReports] = useState<UploadedFile[]>([])
  const [prevReports, setPrevReports] = useState<UploadedFile[]>([])
  const [excluded, setExcluded] = useState<Set<MatchField>>(new Set())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [processed, setProcessed] = useState(false)
  const [running, setRunning] = useState(false)

  const [annualNotifs, setAnnualNotifs] = useState<UploadedFile[]>([])
  const [annualReports, setAnnualReports] = useState<UploadedFile[]>([])
  const [annualPrevReports, setAnnualPrevReports] = useState<UploadedFile[]>([])
  const [annualExcluded, setAnnualExcluded] = useState<Set<MatchField>>(new Set())
  const [annualLogs, setAnnualLogs] = useState<LogEntry[]>([])
  const [annualProcessed, setAnnualProcessed] = useState(false)
  const [annualRunning, setAnnualRunning] = useState(false)
  const [annualTaxIssues, setAnnualTaxIssues] = useState<AnnualTaxIssue[]>([])
  const [annualTaxOverrides, setAnnualTaxOverrides] = useState<Record<string, number>>({})

  const logEndRef = useRef<HTMLDivElement>(null)
  const isAnnual = mode === 'annual'
  const isReconciliation = mode === 'reconciliation'
  const isCyberpunk = mode === 'cyberpunk'

  useEffect(() => {
    document.body.classList.toggle('theme-annual', isAnnual)
    document.body.classList.toggle('theme-reconciliation', isReconciliation)
    document.body.classList.toggle('theme-cyberpunk', isCyberpunk)
    return () => {
      document.body.classList.remove('theme-annual')
      document.body.classList.remove('theme-reconciliation')
      document.body.classList.remove('theme-cyberpunk')
    }
  }, [isAnnual, isReconciliation, isCyberpunk])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ndfl-section-colors')
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string | Partial<SectionPalette>>
        const migrated = { ...DEFAULT_SECTION_PALETTES }
        for (const section of Object.keys(DEFAULT_SECTION_PALETTES) as PaletteSection[]) {
          const value = parsed[section]
          migrated[section] = typeof value === 'string'
            ? { ...DEFAULT_SECTION_PALETTES[section], color: value }
            : { ...DEFAULT_SECTION_PALETTES[section], ...(value ?? {}) }
        }
        setSectionPalettes(migrated)
      }
    } catch {
      setSectionPalettes(DEFAULT_SECTION_PALETTES)
    }
  }, [])

  const changeSectionPalette = (section: PaletteSection, values: Partial<SectionPalette>) => {
    setSectionPalettes(prev => {
      const next = {
        ...prev,
        [section]: { ...prev[section], ...values },
      }
      localStorage.setItem('ndfl-section-colors', JSON.stringify(next))
      return next
    })
  }

  const resetSectionPalette = (section: PaletteSection) => {
    setSectionPalettes(prev => {
      const next = { ...prev, [section]: { ...DEFAULT_SECTION_PALETTES[section] } }
      localStorage.setItem('ndfl-section-colors', JSON.stringify(next))
      return next
    })
  }

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info', annual = false) => {
    const setter = annual ? setAnnualLogs : setLogs
    setter(prev => {
      const next = [...prev, { time: nowTime(), text, type }]
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      return next
    })
  }, [])

  const quarterlySetters: Record<FileBucket, React.Dispatch<React.SetStateAction<UploadedFile[]>>> = {
    notifs: setNotifs, prevReports: setPrevReports, reports: setReports,
  }
  const annualSetters: Record<FileBucket, React.Dispatch<React.SetStateAction<UploadedFile[]>>> = {
    notifs: setAnnualNotifs, prevReports: setAnnualPrevReports, reports: setAnnualReports,
  }

  const addFiles = (key: FileBucket, files: File[], annual = false) => {
    const setter = annual ? annualSetters[key] : quarterlySetters[key]
    setter(prev => {
      const existingKeys = new Set(prev.map(f => f.file.name + f.file.size))
      const fresh = files.filter(f => !existingKeys.has(f.name + f.size))
      return [...prev, ...fresh.map(f => ({ id: uid(), file: f }))]
    })
    if (annual) {
      setAnnualProcessed(false)
      setAnnualTaxIssues([])
      setAnnualTaxOverrides({})
    } else {
      setProcessed(false)
    }
  }

  const removeFile = (key: FileBucket, id: string, annual = false) => {
    const setter = annual ? annualSetters[key] : quarterlySetters[key]
    setter(prev => prev.filter(f => f.id !== id))
    if (annual) {
      setAnnualProcessed(false)
      setAnnualTaxIssues([])
      setAnnualTaxOverrides({})
    } else {
      setProcessed(false)
    }
  }

  const toggleExclude = (field: MatchField, annual = false) => {
    const setter = annual ? setAnnualExcluded : setExcluded
    setter(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
    if (annual) {
      setAnnualProcessed(false)
      setAnnualTaxIssues([])
      setAnnualTaxOverrides({})
    } else {
      setProcessed(false)
    }
  }

  const reset = (annual = false) => {
    if (annual) {
      setAnnualNotifs([]); setAnnualPrevReports([]); setAnnualReports([])
      setAnnualExcluded(new Set()); setAnnualLogs([]); setAnnualProcessed(false)
      setAnnualTaxIssues([]); setAnnualTaxOverrides({})
    } else {
      setNotifs([]); setPrevReports([]); setReports([])
      setExcluded(new Set()); setLogs([]); setProcessed(false)
    }
  }

  const runQuarterly = async () => {
    setRunning(true); setLogs([])
    addLog(`Запуск обработки: ${reports.length} отчёт(ов)...`, 'info')
    const formData = new FormData()
    notifs.forEach(f => formData.append('notifications', f.file))
    prevReports.forEach(f => formData.append('prevReports', f.file))
    reports.forEach(f => formData.append('reports', f.file))
    formData.append('excludeMatch', JSON.stringify([...excluded]))
    try {
      const res = await fetch('/api/process-reports', { method: 'POST', body: formData })
      if (!res.ok) { addLog(`✗ Ошибка сервера: ${(await res.json()).error || 'Неизвестная ошибка'}`, 'err'); return }
      const json = await res.json() as { files: { name: string; data?: string; error?: string }[] }
      for (const item of json.files) {
        if (!item.data) addLog(`✗ ${item.name}: ${item.error || 'нет данных'}`, 'err')
        else addLog(`✓ Подготовлен: ${item.name}`, 'ok')
      }
      const count = await downloadZip(json.files, 'updated-reports')
      if (count === 0) addLog('✗ Нет успешно собранных отчётов', 'err')
      else { addLog(`✓ Скачан ZIP: ${count} файл(ов)`, 'ok'); setProcessed(true) }
    } catch (e: any) { addLog(`✗ Ошибка сети: ${e.message}`, 'err') }
    finally { setRunning(false) }
  }

  const submitAnnual = async (taxOverrides: Record<string, number>) => {
    setAnnualRunning(true); setAnnualLogs([])
    setAnnualTaxIssues([])
    addLog(`Запуск годовой сборки: ${annualReports.length} отчёт(ов)...`, 'info', true)
    try {
      const requestZip = new JSZip()
      const addFilesToZip = (folder: string, files: UploadedFile[]) =>
        files.map((uploaded, index) => {
          const path = `${folder}/${index}.xml`
          requestZip.file(path, uploaded.file)
          return { name: uploaded.file.name, path }
        })
      const manifest = {
        reports: addFilesToZip('reports', annualReports),
        notifications: addFilesToZip('notifications', annualNotifs),
        prevReports: addFilesToZip('prev-reports', annualPrevReports),
        excludeMatch: [...annualExcluded],
        taxOverrides,
      }
      requestZip.file('manifest.json', JSON.stringify(manifest))
      const requestBody = await requestZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      const res = await fetch('/api/process-annual-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: requestBody,
      })
      if (!res.ok) {
        const errorText = await res.text()
        let errorBody: {
          error?: string
          issues?: Omit<AnnualTaxIssue, 'targetValue' | 'fixed'>[]
        }
        try {
          errorBody = JSON.parse(errorText)
        } catch {
          errorBody = {
            error: res.status === 413
              ? 'Размер даже сжатого архива превышает лимит Vercel 4,5 МБ'
              : errorText || `HTTP ${res.status}`,
          }
        }
        if (res.status === 422 && errorBody.issues?.length) {
          setAnnualTaxIssues(errorBody.issues.map(issue => ({
            ...issue,
            targetValue: String(issue.calculatedTotal),
            fixed: false,
          })))
          addLog(`Требуется исправить налог у ${errorBody.issues.length} сотрудник(ов)`, 'warn', true)
          return
        }
        addLog(`✗ Ошибка сервера: ${errorBody.error || 'Неизвестная ошибка'}`, 'err', true)
        return
      }

      if (res.headers.get('content-type')?.includes('application/zip')) {
        const resultZip = await res.blob()
        downloadBlob(resultZip, `annual-reports-${Date.now()}.zip`)
        annualReports.forEach(item => addLog(`✓ Подготовлен: ${item.file.name}`, 'ok', true))
        addLog(`✓ Скачан ZIP: ${annualReports.length} файл${plural(annualReports.length)}`, 'ok', true)
        setAnnualProcessed(true)
        return
      }

      const json = await res.json() as { files: { name: string; data?: string; error?: string }[] }
      for (const item of json.files) {
        if (!item.data) addLog(`✗ ${item.name}: ${item.error || 'нет данных'}`, 'err', true)
        else addLog(`✓ Подготовлен: ${item.name}`, 'ok', true)
      }
      const count = await downloadZip(json.files, 'annual-reports')
      if (count === 0) addLog('✗ Нет успешно собранных отчётов', 'err', true)
      else { addLog(`✓ Скачан ZIP: ${count} файл(ов)`, 'ok', true); setAnnualProcessed(true) }
    } catch (e: any) { addLog(`✗ Ошибка сети: ${e.message}`, 'err', true) }
    finally { setAnnualRunning(false) }
  }

  const runAnnual = () => submitAnnual(annualTaxOverrides)

  const updateTaxIssueValue = (personKey: string, value: string) => {
    setAnnualTaxIssues(prev => prev.map(issue =>
      issue.personKey === personKey
        ? { ...issue, targetValue: value, fixed: false }
        : issue,
    ))
  }

  const fixTaxIssue = (personKey: string) => {
    const issue = annualTaxIssues.find(item => item.personKey === personKey)
    if (!issue) return
    const entered = Number(issue.targetValue)
    const amount = Number.isFinite(entered) && entered >= 0
      ? Math.round(entered)
      : issue.calculatedTotal
    setAnnualTaxOverrides(prev => ({ ...prev, [personKey]: amount }))
    setAnnualTaxIssues(prev => prev.map(item =>
      item.personKey === personKey
        ? { ...item, targetValue: String(amount), fixed: true }
        : item,
    ))
  }

  const fixAllTaxIssues = () => {
    const nextOverrides = { ...annualTaxOverrides }
    const nextIssues = annualTaxIssues.map(issue => {
      const entered = Number(issue.targetValue)
      const amount = Number.isFinite(entered) && entered >= 0
        ? Math.round(entered)
        : issue.calculatedTotal
      nextOverrides[issue.personKey] = amount
      return { ...issue, targetValue: String(amount), fixed: true }
    })
    setAnnualTaxOverrides(nextOverrides)
    setAnnualTaxIssues(nextIssues)
  }

  const closeTaxIssues = () => {
    for (const issue of annualTaxIssues) {
      addLog(
        `✗ Исходная сумма налога сотрудника ${issue.personKey} некорректна: ` +
        `остаток ${issue.remainingDiff} руб. нельзя распределить с ограничением 1 рубль на отчёт.`,
        'err',
        true,
      )
    }
    setAnnualTaxIssues([])
    setAnnualTaxOverrides({})
  }

  const qReady = notifs.length > 0 && reports.length > 0 && !running
  const aReady = annualReports.length > 0 && !annualRunning

  const renderWorkflow = (annual: boolean) => {
    const n = annual ? annualNotifs : notifs
    const p = annual ? annualPrevReports : prevReports
    const r = annual ? annualReports : reports
    const ex = annual ? annualExcluded : excluded
    const lg = annual ? annualLogs : logs
    const proc = annual ? annualProcessed : processed
    const run = annual ? runAnnual : runQuarterly
    const ready = annual ? aReady : qReady
    const isRun = annual ? annualRunning : running

    const step1 = n.length > 0 ? 'done' : annual ? 'idle' : 'active'
    const step3 = r.length > 0 ? 'done' : annual || n.length > 0 ? 'active' : 'idle'
    const step4 = proc ? 'done' : (ready || isRun) ? 'active' : 'idle'

    return (
      <>
        {annual && (
          <div className="lg:hidden mb-6 bg-annual-surface border border-annual-border rounded-xl p-4">
            <div className="text-xs font-semibold text-[#e8e9f0] mb-3">Исключить для заполнения</div>
            <div className="flex flex-col gap-2">
              {ALL_MATCH_FIELDS.map((field) => (
                <label key={field} className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input type="checkbox" checked={ex.has(field)} onChange={() => toggleExclude(field, true)}
                    className="rounded accent-annual-accent" />
                  <span>{MATCH_FIELD_LABELS[field]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {annual ? 'Годовая отчётность 6-НДФЛ' : 'Обновление отчётов'}
          </h1>
          <p className="text-muted text-sm">
            {annual
              ? 'Сборка годовых отчётов по справкам 2-НДФЛ, уведомлениям и отчётам прошлого квартала'
              : 'Загрузите уведомления и отчёты — система заполнит строки 021–026, 140, 160, 131, 120 по каждому КБК'}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <StepCard annual={annual} number="1" title="Уведомления" status={step1}
            desc={annual
              ? 'Необязательно. Без уведомления первые пять сроков будут равны 0'
              : 'XML-файлы уведомлений об исчисленных суммах налога'}
            badge={n.length > 0 ? `${n.length} файл${plural(n.length)}` : annual ? 'не загружены' : '0 файлов'}>
            <DropZone annual={annual} label="XML-уведомления" hint="*.xml • несколько файлов" icon={Bell}
              onFiles={f => addFiles('notifs', f, annual)} />
            {n.length > 0 && (
              <div className="flex flex-col gap-2">
                {n.map(f => <FileItem annual={annual} key={f.id} name={f.file.name} size={f.file.size}
                  onRemove={() => removeFile('notifs', f.id, annual)} />)}
              </div>
            )}
          </StepCard>

          <div className="flex justify-center"><ChevronRight className="w-5 h-5 text-border-hi rotate-90" /></div>

          <StepCard annual={annual} number="2" title={annual ? 'Отчёты прошлого квартала' : 'Отчёты прошлого периода'}
            status={p.length > 0 ? 'done' : 'idle'}
            desc={annual
              ? 'Необязательно. Сопоставление по ИНН, КПП, ОКТМО и отчётному году'
              : 'Необязательно. Сопоставление по ИНН, КПП, ОКТМО и отчётному году (код Период может отличаться)'}
            badge={p.length > 0 ? `${p.length} файл${plural(p.length)}` : 'не загружены'}>
            <DropZone annual={annual}
              label={annual ? 'XML-отчёты прошлого квартала' : 'XML-отчёты прошлого периода'}
              hint="*.xml • необязательно" icon={History}
              onFiles={f => addFiles('prevReports', f, annual)} />
            {p.length > 0 && (
              <div className="flex flex-col gap-2">
                {p.map(f => <FileItem annual={annual} key={f.id} name={f.file.name} size={f.file.size}
                  onRemove={() => removeFile('prevReports', f.id, annual)} />)}
              </div>
            )}
          </StepCard>

          <div className="flex justify-center"><ChevronRight className="w-5 h-5 text-border-hi rotate-90" /></div>

          <StepCard annual={annual} number="3"
            title={annual ? 'Годовые отчёты 6-НДФЛ' : 'Отчёты 6-НДФЛ'}
            status={step3}
            desc={annual ? 'XML-файлы годовых отчётов со справками 2-НДФЛ' : 'XML-файлы отчётов, которые нужно обновить'}
            badge={r.length > 0 ? `${r.length} файл${plural(r.length)}` : '0 файлов'}>
            <DropZone annual={annual}
              label={annual ? 'XML-годовые отчёты 6-НДФЛ' : 'XML-отчёты 6-НДФЛ'}
              hint="*.xml • несколько файлов" icon={FileText}
              onFiles={f => addFiles('reports', f, annual)} />
            {r.length > 0 && (
              <div className="flex flex-col gap-2">
                {r.map(f => <FileItem annual={annual} key={f.id} name={f.file.name} size={f.file.size}
                  onRemove={() => removeFile('reports', f.id, annual)} />)}
              </div>
            )}
          </StepCard>

          <div className="flex justify-center"><ChevronRight className="w-5 h-5 text-border-hi rotate-90" /></div>

          <StepCard annual={annual} number="4" title="Собрать отчёты" status={step4}
            desc="Заполнить строки и скачать обновлённый XML-файл"
            badge={isRun ? 'обработка...' : proc ? 'скачано' : ready ? 'готово к запуску' : 'ожидание'}>
            <div className="flex gap-3 flex-wrap">
              <button onClick={run} disabled={!ready}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  ready
                    ? annual
                      ? 'bg-annual-accent text-white hover:bg-annual-accent-hi hover:-translate-y-0.5 hover:shadow-lg hover:shadow-annual-accent/30'
                      : 'bg-accent text-white hover:bg-accent-hi hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30'
                    : 'bg-border text-muted cursor-not-allowed opacity-50'
                }`}>
                {isRun ? <><Loader2 className="w-4 h-4 animate-spin" /> Обработка...</>
                  : <><Zap className="w-4 h-4" /> Собрать и скачать</>}
              </button>
              <button onClick={() => reset(annual)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-border text-[#e8e9f0] hover:bg-border-hi transition-all">
                <RotateCcw className="w-4 h-4" /> Сбросить
              </button>
            </div>
            {lg.length > 0 && (
              <div className={`border rounded-xl p-4 max-h-64 overflow-y-auto ${annual ? 'bg-annual-bg border-annual-border' : 'bg-bg border-border'}`}>
                {lg.map((e, i) => <LogLine key={i} entry={e} />)}
                <div ref={logEndRef} />
              </div>
            )}
          </StepCard>
        </div>

        <div className={`mt-8 flex gap-3 p-4 border rounded-xl ${annual ? 'bg-annual-surface border-annual-border' : 'bg-surface border-border'}`}>
          <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${annual ? 'text-annual-accent-hi' : 'text-accent-hi'}`} />
          <p className="text-xs text-muted leading-relaxed">
            {annual
              ? 'Годовая сборка: справки 2-НДФЛ пересчитываются по формуле НалБаза × ставка, разделы 1–2 заполняются итогами справок, 6-й срок = строка 160 − 5 сроков уведомлений − строка 160 прошлого квартала.'
              : 'Обработка XML происходит на сервере. Система конвертирует результат в кодировку Windows-1251 для корректной работы с ПО ФНС.'}
          </p>
        </div>
      </>
    )
  }

  return (
    <>
    <PalettePicker
      palettes={sectionPalettes}
      onChange={changeSectionPalette}
      onReset={resetSectionPalette}
    />
    <button
      onClick={() => {
        setMode('cyberpunk')
        setCyberPresetsOpen(false)
      }}
      className={`cyber-mode-button cyber-mode-button-${cyberPreset} fixed top-3 right-3 z-[70] px-3 py-1.5 font-mono text-xs font-black italic tracking-[.25em] transition-all ${
        isCyberpunk
          ? 'bg-[#fcee09] text-black shadow-[0_0_20px_rgba(252,238,9,.45)]'
          : 'border border-[#fcee09]/60 bg-black/90 text-[#fcee09] hover:bg-[#fcee09] hover:text-black'
      } [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]`}
    >
      2077
    </button>
    {isCyberpunk && (
      <div className={`cyber-preset-menu cyber-preset-menu-${cyberPreset} fixed right-3 top-12 z-[70] w-64 font-mono`}>
        <button
          onClick={() => setCyberPresetsOpen(open => !open)}
          className="flex w-full items-center justify-between border border-[#fcee09]/50 bg-black/95 px-3 py-2 text-left text-[10px] font-bold tracking-wider text-[#fcee09] shadow-[0_0_12px_rgba(252,238,9,.16)] hover:border-[#00f0ff]"
        >
          <span>ПРЕСЕТ: {CYBER_PRESETS[cyberPreset].label.toUpperCase()}</span>
          <span>{cyberPresetsOpen ? '▲' : '▼'}</span>
        </button>
        {cyberPresetsOpen && (
          <div className="mt-1 border border-[#00f0ff]/40 bg-[#05080b]/98 p-2 shadow-[0_0_24px_rgba(0,240,255,.18)]">
            {(Object.keys(CYBER_PRESETS) as CyberPreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => {
                  setCyberPreset(preset)
                  setCyberPresetsOpen(false)
                }}
                className={`mb-1 w-full border-l-2 px-3 py-2 text-left last:mb-0 ${
                  cyberPreset === preset
                    ? 'border-[#fcee09] bg-[#fcee09]/12 text-[#fcee09]'
                    : 'border-[#263840] text-[#9db0b7] hover:border-[#00f0ff] hover:bg-[#00f0ff]/8 hover:text-[#00f0ff]'
                }`}
              >
                <span className="block text-[11px] font-bold">{CYBER_PRESETS[preset].label}</span>
                <span className="mt-0.5 block text-[9px] opacity-70">{CYBER_PRESETS[preset].description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <div className={`${isCyberpunk ? `cyber-shell cyber-preset-${cyberPreset}` : ''} min-h-screen transition-colors duration-500 ${
      isAnnual
        ? 'bg-annual-bg'
        : isReconciliation
          ? 'bg-reconciliation-bg'
          : isCyberpunk
            ? 'bg-[#020306]'
            : 'bg-bg'
    }`} style={{
      filter: isCyberpunk ? 'none' : sectionFilter(mode, sectionPalettes[mode]),
    }}>
      {isAnnual && annualTaxIssues.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-annual-border-hi bg-annual-surface shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-annual-border">
              <h2 className="text-xl font-semibold">Ошибки исходного налога сотрудников</h2>
              <p className="text-sm text-muted mt-1">
                Для этих сотрудников исходный итог нельзя распределить с допуском 1 рубль на отчёт.
                По умолчанию указана математическая сумма по налоговой базе и ставке.
              </p>
            </div>

            <div className="px-6 py-4 border-b border-annual-border flex flex-wrap gap-3">
              <button onClick={fixAllTaxIssues}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-annual-accent text-white hover:bg-annual-accent-hi transition-colors">
                Исправить всех
              </button>
              <button
                onClick={() => submitAnnual(annualTaxOverrides)}
                disabled={annualRunning || annualTaxIssues.some(issue => !issue.fixed)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !annualRunning && annualTaxIssues.every(issue => issue.fixed)
                    ? 'bg-success text-white hover:brightness-110'
                    : 'bg-border text-muted cursor-not-allowed opacity-50'
                }`}>
                {annualRunning ? 'Повторная обработка...' : 'Повторить'}
              </button>
              <button onClick={closeTaxIssues}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-border text-[#e8e9f0] hover:bg-border-hi transition-colors">
                Закрыть
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-3">
              {annualTaxIssues.map(issue => (
                <div key={issue.personKey}
                  className={`rounded-xl border p-4 ${
                    issue.fixed
                      ? 'border-success/60 bg-success/5'
                      : 'border-annual-border bg-annual-bg'
                  }`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-medium">{issue.fullName || 'ФИО не указано'}</div>
                      <div className="text-xs text-muted font-mono mt-1">ИНН: {issue.inn || 'не указан'}</div>
                    </div>
                    {issue.fixed && (
                      <span className="text-xs text-success font-medium">Исправление задано</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                    <div>
                      <div className="text-muted">Исходная сумма</div>
                      <div className="font-mono mt-1">{issue.originalTotal} ₽</div>
                    </div>
                    <div>
                      <div className="text-muted">По базе и ставке</div>
                      <div className="font-mono mt-1">{issue.calculatedTotal} ₽</div>
                    </div>
                    <div>
                      <div className="text-muted">Нераспределённый остаток</div>
                      <div className="font-mono mt-1 text-danger">{issue.remainingDiff} ₽</div>
                    </div>
                    <div>
                      <div className="text-muted">Отчётов с сотрудником</div>
                      <div className="font-mono mt-1">{issue.reportCount}</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <label className="flex-1">
                      <span className="block text-xs text-muted mb-1.5">
                        Общая сумма налога для сравнения
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={issue.targetValue}
                        onChange={event => updateTaxIssueValue(issue.personKey, event.target.value)}
                        className="w-full rounded-lg border border-annual-border-hi bg-annual-surface px-3 py-2 text-sm font-mono outline-none focus:border-annual-accent"
                      />
                    </label>
                    <button onClick={() => fixTaxIssue(issue.personKey)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-annual-accent text-white hover:bg-annual-accent-hi transition-colors">
                      Исправить налог
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(mode === 'quarterly' || mode === 'annual') && (
        isAnnual
          ? <ExcludePanel annual excluded={annualExcluded} onToggle={f => toggleExclude(f, true)} />
          : <ExcludePanel excluded={excluded} onToggle={f => toggleExclude(f, false)} />
      )}

      <header className={`cyber-app-header border-b sticky top-0 z-10 transition-colors duration-500 ${
        isAnnual
          ? 'border-annual-border bg-annual-surface'
          : isReconciliation
            ? 'border-reconciliation-border bg-reconciliation-surface'
            : isCyberpunk
              ? 'border-[#fcee09]/25 bg-[#07090d]'
              : 'border-border bg-surface'
      }`}>
        <div className={`${isReconciliation || isCyberpunk ? 'max-w-7xl' : 'max-w-3xl'} mx-auto px-6 py-4 flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className={`cyber-app-logo w-9 h-9 rounded-xl flex items-center justify-center font-mono text-sm font-medium flex-shrink-0 ${
              isAnnual
                ? 'bg-annual-accent text-white'
                : isReconciliation
                  ? 'bg-reconciliation-accent text-[#102713]'
                  : isCyberpunk
                    ? 'bg-[#fcee09] text-black'
                    : 'bg-accent text-white'
            }`}>НД</div>
            <div className="flex-1">
              <div className="font-semibold text-[15px] leading-none">6-НДФЛ Updater</div>
              <div className="text-xs text-muted mt-0.5">Обновление отчётов по уведомлениям</div>
            </div>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      <main className={`${isReconciliation || isCyberpunk ? 'max-w-7xl' : 'max-w-3xl lg:pl-60'} mx-auto px-6 py-12 transition-colors duration-500`}>
        {mode === 'quarterly' && (
          <div className="lg:hidden mb-6 bg-surface border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-[#e8e9f0] mb-3">Исключить для заполнения</div>
            <div className="flex flex-col gap-2">
              {ALL_MATCH_FIELDS.map((field) => (
                <label key={field} className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input type="checkbox" checked={excluded.has(field)} onChange={() => toggleExclude(field, false)}
                    className="rounded accent-accent" />
                  <span>{MATCH_FIELD_LABELS[field]}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {isReconciliation
          ? <NdflReconciliation />
          : isCyberpunk
            ? <Cyberpunk2077 preset={cyberPreset} />
          : isAnnual
            ? renderWorkflow(true)
            : renderWorkflow(false)}
      </main>
    </div>
    </>
  )
}
