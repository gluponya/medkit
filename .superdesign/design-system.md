# Design system — Medkit («Аптечка»)

## Product

A phone app (iPhone first, React Native, portrait, light theme) for keeping track
of the medicines at hand: what is there, what has expired or is about to, how
much is left, and reminders to take them. Audience: Ukrainian households. The app
ships in **Ukrainian first** (all copy in drafts is Ukrainian) and English.

One person usually has several cabinets («аптечки»):

- **Дім** — own cabinet, mode «з прийомом»: expiry + intake reminders + stock.
- **Машина**, **Дача**, **Батьки** — mode «тільки терміни»: only the list and
  expiry dates. No intake section at all on these.

The core job is **"don't get caught with expired or missing medicine"**. The
second job (home cabinet only) is **"take my pills on time and know when to buy
more"**. Everything on screen should answer "what needs my attention" first.

Works without an account. Data model and journeys: `docs/model.md`,
`docs/journeys.md`, screen list: `docs/screens.md`.

## Visual language (from the owner's Figma — keep it)

Calm, clean, "medical but friendly". Soft periwinkle background, white cards,
one confident blue, gentle status colours. It must not look like a template or
AI-made: no gradients, no glassmorphism, no neon, no purple, no dark hero
blocks, no stock illustrations.

### Colour tokens

| Token | Value | Use |
|---|---|---|
| bg | #EEF3FE | App background behind cards |
| surface | #FFFFFF | Cards, sheets, tab bar |
| surface-soft | #F7F9FE | Inner fields, secondary buttons |
| line | #DCE3F2 | 1px card and field borders |
| ink | #2F3A4F | Titles, medicine names |
| ink-muted | #66718A | Secondary text (never lighter than this for text) |
| primary | #4A6CF7 | Primary buttons, active tab, links, selected states |
| primary-soft | #E6ECFE | Selected chips, secondary button fill |
| danger | #E0352B | Expired; destructive actions (text, not big filled buttons) |
| danger-soft | #FDE8E6 | Expired chip background |
| warning | #D9800B | Expiring soon / low stock |
| warning-soft | #FEF2DF | Their chip background |
| success | #1F9D63 | Good / taken |
| success-soft | #E2F5EB | Its chip background |

### Type

Font: **Manrope** (has Cyrillic), fallback SF Pro / system.

| Role | Size / weight |
|---|---|
| Screen title | 28 / 700 |
| Section title | 18 / 700 |
| Card title, medicine name | 16 / 600 |
| Body | 15 / 400 |
| Secondary line («Пігулки · 200 мг») | 13 / 500, ink-muted |
| Chip / caption | 12 / 600 — **nothing smaller than 12** |

### Shape and spacing

- Spacing scale 4 / 8 / 12 / 16 / 20 / 24. Screen side padding 16.
- Cards: white, 1px `line` border, radius 16, no heavy shadow (at most
  0 1px 2px rgba(47,58,79,.06)).
- Buttons: height 48–52, radius 14. Primary = filled `primary`, white text.
  Secondary = `primary-soft` fill, `primary` text. Disabled = `surface-soft`
  fill, `ink-muted` text, no border (must not look tappable).
- Chips: radius 999, 12/600, soft fill + matching strong text, a 6px dot before
  the text for statuses.
- Icons: thin line icons (Lucide style, 1.75 stroke), `ink-muted` or `primary`.
  Emoji only as category-tag markers, never as UI icons.
- **No cards inside cards.** Lists are rows inside one card with 1px dividers.

## Status language

Every medicine row shows at most one expiry chip and one stock chip:

- «Протерміновано» — danger chip; the date in danger colour.
- «Ще 12 днів» / «Закінчується термін» — warning chip.
- «Мало: 2 шт» — warning chip (only when stock is counted).
- No chip when all is fine; the expiry date shows as plain muted text «до 09.2027».

Expiry dates are shown as **month/year** («до 09.2027»), like on the pack.

## Navigation

Bottom tab bar, white, with icons **and labels**:
«Аптечка» (home) · «Сьогодні» (intake; hidden content if no reminders) ·
«Покупки» (shopping list) · «Налаштування».
Adding a medicine is not a tab: a prominent primary button «Додати» (with a scan
icon) on the cabinet screen. Tab root screens have no back arrow.

The current cabinet is switched from the title: «Дім ▾» opens a sheet with
cabinets (Дім, Машина, Дача, Батьки) and «Додати аптечку».

## Copy rules

Ukrainian, short, verbs on buttons in the infinitive, never gendered (no «Прийняла»/«Прийняв»): «Прийняти», «Пропустити», «Утилізувати», «Купити»,
«Додати», «Сканувати». Use «Термін придатності», «акаунт» (one к), «Краплі».
Use realistic Ukrainian-market medicines in examples: Нурофен (ібупрофен),
Парацетамол-Дарниця, Називін, Ентеросгель, Сорбіфер Дурулес, Аквадетрим
(вітамін D3), Цитрамон, Смекта, Лоратадин, Бепантен.
