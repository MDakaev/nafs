# Nafs

Web app / PWA: счётчик маленьких побед над собой.

## Локально

Открой `index.html` через любой static server, например:

```bash
npx serve .
```

## Установка на телефон

1. Открой сайт по HTTPS
2. Android: «Установить приложение» / Add to Home screen
3. iPhone Safari: Поделиться → На экран «Домой»

## Стек

Чистый HTML / CSS / JS, без фреймворков. Данные хранятся локально в браузере.

## Структура

- `index.html` — UI
- `js/app.js` — логика
- `js/i18n.js` — RU/EN language pack
- `js/motivations.js` — цитаты
- `js/config.js` — ссылки донатов
- `docs/DONATIONS.md` — как принимать пожертвования
- `docs/ANALYTICS.md` — Яндекс.Метрика
- `QUOTES.md` — полный список цитат

## Форматирование

```bash
npm install
npm run format
```
