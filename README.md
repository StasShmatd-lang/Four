# Хор аплодисментов (`applause-choir`)

Две половины зала соревнуются «кто громче» через уровень микрофона телефона (или тап «ХЛОП»).

## Роли

| Роль | URL | Что делает |
|------|-----|------------|
| Ведущий | `/` → `/host/{id}` | Команды A/B (имя, цвет, фото капитана), 5–10 с раунд, QR, старт |
| Гость | `/join/{id}` | Имя + команда → mic level или тап |
| Экран зала | `/screen/{id}#s=…` | Два столбика и победитель |

Токены: `Authorization: Bearer` и screen `#s=` — **не** в query.

Аудиозаписи **не** хранятся: на сервер уходит только число уровня 0–100.

## Запуск

```bash
cd next-app
npm install
env -u DATABASE_URL npm run dev
```

Откройте http://127.0.0.1:3000

Локально — PGlite. На Cursor Cloud Apps — Postgres через `cursor-app.json`.

## Стек

Next.js 15 App Router · Postgres/PGlite · HTTP polling · Unbounded + Manrope

## Скриншоты

`docs/screenshots/applause-*.png` и копии в Project media.
