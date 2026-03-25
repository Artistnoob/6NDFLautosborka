# 6-НДФЛ Updater

Веб-приложение для обновления отчётов 6-НДФЛ по данным из уведомлений.
Стек: **Next.js 15 · TypeScript · Tailwind CSS**.

## Быстрый старт (локально)

```bash
# 1. Установить зависимости
npm install

# 2. Запустить dev-сервер
npm run dev
```

Открыть в браузере: **http://localhost:3000**

---

## Деплой на Vercel

### Вариант 1 — через GitHub (рекомендуется)

```bash
# Инициализировать git-репозиторий (если ещё не сделано)
git init
git add .
git commit -m "initial commit"

# Создать репозиторий на GitHub и запушить
git remote add origin https://github.com/<ваш-логин>/<название-репо>.git
git push -u origin main
```

Затем на [vercel.com](https://vercel.com):
1. New Project → Import Git Repository
2. Выбрать репозиторий → Deploy

Vercel автоматически определит Next.js — никаких настроек не нужно.

### Вариант 2 — через Vercel CLI

```bash
npm i -g vercel
vercel
```

---

## Структура проекта

```
ndfl6-updater/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── process-reports/
│   │   │       └── route.ts      # API: принимает FormData, возвращает XML
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              # Главная страница (UI)
│   └── lib/
│       └── xmlProcessor.ts       # Логика обработки XML (маппинги, расчёты)
├── ndfl6_updater.py              # Python-версия (для локального запуска)
├── package.json
├── tailwind.config.ts
└── next.config.js
```

## Логика расчётов

По каждому КБК в каждом отчёте:

| Строка | Атрибут XML       | Формула                              |
|--------|-------------------|--------------------------------------|
| 161–166 | СумНал1–6Срок    | ← из уведомлений                    |
| 021–026 | СумНалУдерж*Мес  | ← из уведомлений                    |
| **160** | СумНалУдерж      | = сумма строк 021–026                |
| **140** | СумНалИсч        | = строка 160                         |
| **131** | НалБаза          | = round(140 / ставка, 2)            |
| **120** | СумНачислНач     | = round(131 + 130, 2)               |
