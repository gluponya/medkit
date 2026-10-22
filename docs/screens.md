# Screens

Collected from `docs/journeys.md`. **Figma** points to the exported frame in
`design/figma/` (by its number) that the screen grows from.

- **keep**: the Figma screen works; polish only.
- **redo**: the idea is there, the logic or layout changes.
- **new**: nothing in Figma yet.

## Core (first version)

| Screen | Journeys | Figma | What it does / what changes |
|---|---|---|---|
| Welcome | J1, J7 | 039 · redo | The mark, the name and one line in the middle; «Почати» without an account; «У мене є запрошення» as a secondary button. |
| Where is the cabinet | J1 | new | Дім / Машина / Дача / Батьки / Інше as tiles, a line under each says what it tracks. The picked tile opens with the name (prefilled) and twelve icon tiles (preset from the place). Also used for «Додати аптечку». |
| First steps (on Home) | J1 | new | Empty Home on the first visit: a «Перші кроки» card with two steps, add medicines and (only `with_intake`) reminders. The open step has its buttons and «Пізніше»; done steps get a tick, skipped ones reopen on a tap. Gone for good once every step is done or skipped. |
| Home | J1–J6 | 002, 001 · redo | Cabinet switcher in the title, search, next dose with «Прийняти» (only `with_intake`), «Потребує уваги» (expired, expiring, low stock), then a compact list. One version, not two. |
| Today | J3 | 038 · redo | Today's doses as a timeline: past and later doses are small rows marked by a circle, the next dose is a big card with the only «Прийняти» (and «Пізніше»). Below, every active reminder: how many times a day, at what times, how long the course runs. Empty state: one message and «Додати нагадування». |
| Scanner | J2, J5 | new | Camera, EAN-13 and DataMatrix, «Ввести вручну». A mode for scanning many packs in a row. |
| Register search | J2, J6 | 058 · redo | Search over the local Register by name and substance, the match in bold. Each row: name, substance · form · strength; «Є в «Дім»» when the cabinet has it. Under the results, «Немає в списку?» with «Сфотографувати коробку» and «Ввести вручну». Nothing found: why (supplements and foreign medicines are not in the Register) and one button «Ввести вручну»; no photo there, since a photo only searches the same Register. Also the "code not found" path. |
| Box photo | J2 | new | "Code not found": camera for the front of the box, then the flap for the expiry; reading state; the result opens Register search with the match on top. |
| Confirm medicine | J2 | 062 · redo | Found data + expiry (required), quantity (no «opened» switch: see Package.opened_at). If the medicine already exists, a line in the found card says it becomes another pack and tags are not asked; a new medicine also gets optional tags. One primary button «Додати в «Дім»». |
| Add by hand | J2 | 019 · redo | Manual entry as five steps, one question per screen, a progress bar and «Крок N з 5», «Скасувати» on every step: 1) name, a text field («Далі» disabled while empty); 2) form, tiles (sets the unit); 3) expiry, four year tiles (from the current year) with small ‹ › that shift them, so there is no last year, and month tiles in the same grid; nothing is picked at first and «Далі» is disabled; once both are picked, a card above the button says «Придатні до кінця березня 2027 · Ще 17 міс.»; 4) quantity, a number field focused with the number pad up, tiles 30/60/90/120 fill it and close the keyboard, «Не рахувати, просто є» skips counting; 5) «Від чого ці ліки?», the category tiles of Categories, optional («Можна пропустити»), then «Додати в «Дім»». Rx is not asked: supplements and foreign medicines rarely need one, and it stays in details. Every choice is a tile: no tappable text next to buttons. Everything else goes to Medicine details. |
| Medicine details | J2–J6 | 019 · redo | Opened from the medicine card «⋯ → Деталі»; also the edit form. Grouped rows with the value and a chevron: «Ліки» (name, form, strength, substance, manufacturer; «не вказано» when empty) and «Пошук і покупки» (tags, low-stock threshold, Rx switch). Subtitle «Усе можна не заповнювати». |
| Categories | J2, J6 | 024–029, 052 · redo | From details «Категорії». Several can be picked: two columns of tiles with an icon, the picked ones blue with a check. Pharmacy-style list (Знеболювальні, Від застуди, Від алергії, Вітаміни, Серце і судини, Шлунок і кишечник, Антибіотики, Шкіра, Очі, вуха, ніс, Нерви і сон, Перша допомога) and a dashed tile «Своя категорія». «Зберегти» is disabled until something changes. |
| Own category | J2 | 052 · redo | A name field and an icon picked from twelve tiles, «Додати категорію». The new category comes back picked. |
| Medicine | J3–J6 | 037 · keep | Under the title, the categories as blue chips that open Categories, and «За рецептом» (a plain label with an Rx icon) first when `rx`; the low-stock line then adds «Потрібен рецепт». Packs with their expiry, quick actions «−1», quantity, «Нагадування», «Інструкція», «Утилізувати», «Купити». Edit and delete in «⋯». Replaces 034/059. |
| New reminder | J3 | 035, 036 · redo | The title asks «Як приймати <medicine>?»; four big cards answer it: 1, 2, 3 times a day (with preset times) and «Інше» (days of the week, every N hours, as needed). Nothing is picked at first; after a pick the details appear: time chips (tap to change, «+» to add), dose per intake, course chips (Постійно / 7 / 14 / 30 / Інше), and a plain summary of the end date and the stock: doses needed against the stock, the rest goes to the shopping list. «Зберегти» is disabled until a card is picked. |
| Search results | J6 | new | Across all cabinets, this one first. |
| Shopping list | J3–J5 | new | Local list; Rx items marked «потрібен рецепт». |
| Cabinets | J5 | 021, 022 · keep | List of cabinets with counts, «Додати аптечку». |
| Settings | — | 020, 032 · redo | Language, notifications (expiry warning days, missed-dose repeat), account (sign in, delete account), about. Drop «локальне зберігання». |
| First-time hints | J1–J3 | new | Short hints the first time a screen opens (scanner, Today, medicine, cabinet switcher…): one line next to what it explains, gone after a tap or the first use, never shown again. Which screens get one is still to decide. |

## For shared cabinets

| Screen | Journeys | Figma | What it does / what changes |
|---|---|---|---|
| Sign in | J5, J7 | 041, 042 · redo | One screen: Apple, Google, phone. Optional, «Зберегти доступ на новому телефоні»: from Settings, or offered once after joining or inviting. Sharing works without it. |
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
- Quick fill (popular-medicines checklist) and expiry for the picked ones in
  onboarding (2026-10-22): too much to choose at once; Home with first steps
  instead.
- «Дії з ліками» accordions (034, 059).
- Notifications screen (030, 031): its contents go to Home «Потребує уваги» and
  to push notifications.
- Category management screens (024–029) move into tag editing inside the
  medicine form; a separate screen only if tags get many.
