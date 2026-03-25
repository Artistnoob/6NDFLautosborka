import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-onest)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      colors: {
        bg:        '#0e0f13',
        surface:   '#15161c',
        border:    '#252730',
        'border-hi': '#353747',
        accent:    '#5c7cfa',
        'accent-hi': '#7b96ff',
        muted:     '#6b6d7e',
        success:   '#40c57a',
        danger:    '#f06464',
        warning:   '#f0b64e',
      },
      animation: {
        'fade-in': 'fadeIn .3s ease forwards',
        'slide-up': 'slideUp .35s ease forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
export default config
