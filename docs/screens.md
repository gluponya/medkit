# Screens

Collected from `docs/journeys.md`. **Figma** points to the exported frame in
`design/figma/` (by its number) that the screen grows from.

- **keep**: the Figma screen works; polish only.
- **redo**: the idea is there, the logic or layout changes.
- **new**: nothing in Figma yet.

## Core (first version)

| Screen | Journeys | Figma | What it does / what changes |
|---|---|---|---|
| Welcome | J1, J7 | 039 · redo | «Почати» without an account; «У мене є код запрошення». |
| Where is the cabinet | J1 | new | Дім / Машина / Дача / Батьки / Інше. Sets name and mode. Also used for «Додати аптечку». |
| Quick fill | J1 | 051 · redo | Checklist of popular medicines + scan + search. Replaces «Швидкий старт» and categories. |
| Expiry for picked | J1 | new | Month/year for each ticked medicine; «Не знаю». |
| Home | J1–J6 | 002, 001 · redo | Cabinet switcher in the title, search, next dose with «Прийняла» (only `with_intake`), «Потребує уваги» (expired, expiring, low stock), then a compact list. One version, not two. |
| Today | J3 | 038 · redo | Today's doses: taken / missed / upcoming, «Прийняла», «Пропустити». Active reminders below. |
| Scanner | J2, J5 | new | Camera, EAN-13 and DataMatrix, «Ввести вручну». A mode for scanning many packs in a row. |
| Register search | J2, J6 | 058 · redo | Search over the local Register by name and substance. Also the "code not found" path. |
| Confirm medicine | J2 | 062 · redo | Found data + expiry (required), quantity, tags. «Додати як нову упаковку» if it exists. |
| Medicine form | J2 | 019 · redo | Manual entry. Name and expiry required. Also the edit form. |
| Medicine | J3–J6 | 037 · keep | Packs with their expiry, quick actions «−1», quantity, «Нагадування», «Інструкція», «Утилізувала», «Купити». Edit and delete in «⋮». Replaces 034/059. |
| New reminder | J3 | 035, 036 · redo | Times and doses, schedule (adds every N hours and as needed), course, a visible «Зберегти». |
| Search results | J6 | new | Across all cabinets, this one first. |
| Shopping list | J3–J5 | new | Local list; Rx items marked «потрібен рецепт». |
| Cabinets | J5 | 021, 022 · keep | List of cabinets with counts, «Додати аптечку». |
| Settings | — | 020, 032 · redo | Language, notifications (expiry warning days, missed-dose repeat), account (sign in, delete account), about. Drop «локальне зберігання». |

## For shared cabinets

| Screen | Journeys | Figma | What it does / what changes |
|---|---|---|---|
| Sign in | J5, J7 | 041, 042 · redo | One screen: Apple, Google, phone. Shown only when sharing. |
| Phone + code | J5, J7 | 054–057 · redo | Code submits itself after 6 digits; resend is a timer + link. |
| Members | J5 | 023 · redo | Roles; remove behind a swipe or «⋮», not a red bin on every row. |
| Invite | J5 | new | One link that contains the code; share sheet; code shown too. |
| Join | J7 | 046, 047 · redo | Cabinet name, who invited, «Приєднатися»; expired-code state. |

## States to draw

Empty home, empty search, code not found, camera permission refused, no
internet (only matters for shared cabinets and the barcode map), delete
confirmation, push notifications (dose with actions, expiry digest, low stock).

## Dropped from the Figma design

- «Майже готово» with two consent checkboxes (043, 044): the footer on Welcome
  is enough.
- «Створити нову аптечку» with the «Особиста / Сімейна» type and the progress
  bar (045, 048–050).
- Categories step in onboarding (051–053) and «Додати приклади ліків».
- «Дії з ліками» accordions (034, 059).
- Notifications screen (030, 031): its contents go to Home «Потребує уваги» and
  to push notifications.
- Category management screens (024–029) move into tag editing inside the
  medicine form; a separate screen only if tags get many.
