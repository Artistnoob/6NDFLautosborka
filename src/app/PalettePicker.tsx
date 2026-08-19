'use client'

import { useState } from 'react'
import { Palette, X } from 'lucide-react'

export type PaletteSection = 'reconciliation' | 'quarterly' | 'annual' | 'cyberpunk'
export interface SectionPalette {
  color: string
  brightness: number
  saturation: number
}
export type SectionPalettes = Record<PaletteSection, SectionPalette>

const SECTION_LABELS: Record<PaletteSection, string> = {
  reconciliation: 'Сверка НДФЛ',
  quarterly: 'Квартальная отчётность',
  annual: 'Годовая отчётность',
  cyberpunk: '2077',
}

export const DEFAULT_SECTION_PALETTES: SectionPalettes = {
  reconciliation: { color: '#009b79', brightness: 100, saturation: 100 },
  quarterly: { color: '#5c7cfa', brightness: 100, saturation: 100 },
  annual: { color: '#c44d5a', brightness: 100, saturation: 100 },
  cyberpunk: { color: '#fcee09', brightness: 100, saturation: 100 },
}

function hexHue(hex: string): number {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0

  let hue = 0
  const delta = max - min
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}

function hexTone(hex: string): { chroma: number; lightness: number } {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  return {
    chroma: max - min,
    lightness: (max + min) / 2,
  }
}

export function sectionFilter(
  section: PaletteSection,
  palette: SectionPalette,
): string {
  const tone = hexTone(palette.color)
  if (tone.chroma < 0.02) {
    const toneBrightness = 0.7 + tone.lightness * 0.45
    return `grayscale(1) saturate(0%) brightness(${Math.round(palette.brightness * toneBrightness)}%)`
  }
  const baseHue = hexHue(DEFAULT_SECTION_PALETTES[section].color)
  const selectedHue = hexHue(palette.color)
  let difference = selectedHue - baseHue
  if (difference > 180) difference -= 360
  if (difference < -180) difference += 360
  return `hue-rotate(${difference}deg) saturate(${palette.saturation}%) brightness(${palette.brightness}%)`
}

export default function PalettePicker({
  palettes,
  onChange,
  onReset,
}: {
  palettes: SectionPalettes
  onChange: (section: PaletteSection, values: Partial<SectionPalette>) => void
  onReset: (section: PaletteSection) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PaletteSection>('reconciliation')

  return (
    <div className="fixed top-3 left-3 z-[70]">
      <button
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-2 rounded-lg border border-border-hi bg-surface/95 px-3 py-2 text-xs text-[#e8e9f0] shadow-lg backdrop-blur hover:bg-border transition-colors"
      >
        <Palette className="w-3.5 h-3.5" />
        Выбор цветовой палитры
      </button>

      {open && (
        <div className="mt-2 w-72 rounded-xl border border-border-hi bg-surface p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Цвет разделов</div>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-[#e8e9f0]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {(Object.keys(SECTION_LABELS) as PaletteSection[]).map(section => (
              <button
                key={section}
                onClick={() => setSelected(section)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  selected === section ? 'bg-border-hi text-white' : 'bg-border/60 text-muted hover:bg-border'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-white/20"
                  style={{ backgroundColor: palettes[section].color }}
                />
                {SECTION_LABELS[section]}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-3">
            <span className="text-xs text-muted">Выберите оттенок</span>
            <input
              type="color"
              value={palettes[selected].color}
              onChange={event => onChange(selected, {
                color: event.target.value,
                saturation: palettes[selected].saturation === 0 ? 100 : palettes[selected].saturation,
              })}
              className="w-12 h-8 rounded cursor-pointer bg-transparent"
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onChange(selected, { color: '#ffffff', saturation: 0, brightness: 105 })}
              className="rounded-lg border border-white/40 bg-white px-3 py-2 text-xs font-medium text-black hover:bg-white/85"
            >
              Белый
            </button>
            <button
              onClick={() => onChange(selected, { color: '#000000', saturation: 0, brightness: 75 })}
              className="rounded-lg border border-white/25 bg-black px-3 py-2 text-xs font-medium text-white hover:border-white/50"
            >
              Чёрный
            </button>
          </div>
          <label className="block rounded-lg bg-bg px-3 py-3 mt-2">
            <span className="flex justify-between text-xs text-muted mb-2">
              <span>Яркость</span>
              <span>{palettes[selected].brightness}%</span>
            </span>
            <input
              type="range"
              min="65"
              max="135"
              value={palettes[selected].brightness}
              onChange={event => onChange(selected, { brightness: Number(event.target.value) })}
              className="w-full accent-accent"
            />
          </label>
          <label className="block rounded-lg bg-bg px-3 py-3 mt-2">
            <span className="flex justify-between text-xs text-muted mb-2">
              <span>Насыщенность</span>
              <span>{palettes[selected].saturation}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="170"
              value={palettes[selected].saturation}
              onChange={event => onChange(selected, { saturation: Number(event.target.value) })}
              className="w-full accent-accent"
            />
          </label>
          <button
            onClick={() => onReset(selected)}
            className="w-full mt-3 rounded-lg border border-border-hi bg-border/60 px-3 py-2 text-xs text-[#e8e9f0] hover:bg-border-hi transition-colors"
          >
            Вернуть стандартный цвет
          </button>
          <p className="text-[10px] leading-relaxed text-muted mt-3">
            Соотношение светлых и тёмных частей сохраняется при любой настройке.
          </p>
        </div>
      )}
    </div>
  )
}
