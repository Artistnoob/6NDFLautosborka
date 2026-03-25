import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '6-НДФЛ Updater',
  description: 'Обновление отчётов 6-НДФЛ по уведомлениям',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
