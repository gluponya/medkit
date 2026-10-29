# User journeys

A journey is one real situation, told from the user's side: who, what made them
open the app, what they want, every step until they get it, and where it can go
wrong. Screens are not designed here; they are found here. Each step names the
screen it needs, and `docs/screens.md` collects them.

How to read a journey:

- **Who / trigger / goal**: the situation in one line each.
- **Steps**: what the person does → what the app does. `[Screen]` marks a screen.
- **Friction**: where people may get stuck or give up. The design has to answer these.
- **Done when**: the moment the goal is reached.

The person in all journeys is the owner: one adult with her own cabinet at home,
one in the car, one at the dacha, and her parents' cabinet she checks on visits.

---

## J1. First launch

**Who:** just installed the app. **Trigger:** wants to stop finding expired
pills when she has a headache. **Goal:** see her home cabinet in the app.

1. Opens the app → `[Welcome]` the mark, the name and one line, «Почати» and
   a secondary «У мене є запрошення». No account: the phone signs in
   anonymously in the background.
2. «Почати» → `[Where is the cabinet]` Дім / Машина / Дача / Батьки / Інше.
   The picked tile opens: a name prefilled from the place («Інше» starts empty,
   focused, keyboard up) and an icon, preset from the place, with eleven
   others to pick from. Mode comes from the place (Дім: `with_intake`).
   «Створити аптечку».
3. → `[Home]` empty, for the first visit: a «Перші кроки» card. Step 1 «Додати
   ліки, що є вдома»: «Сканувати упаковку», «Знайти за назвою», «Пізніше».
   Step 2 (only `with_intake`) «Налаштувати нагадування»: «Додати
   нагадування», «Пізніше». Nothing here is required.
4. A done step gets a tick, a skipped one shows «Відкладено» and opens again on a
   tap. When every step is done or skipped the card is gone for good; an empty
   cabinet then shows the plain empty state with the same two ways to add.

**Friction:** a long setup before any value (the Figma flow had 8 screens;
a first draft with a popular-medicines checklist and an expiry date for each
was too much to choose at once, 2026-10-22); asking for an account; asking
for categories; adding sample medicines she does not have. **Done when:** she
is on Home in under 30 seconds, and the first medicine is one tap away.

## J2. Add a medicine

**Trigger:** came back from the pharmacy. **Goal:** the new pack is in the
cabinet with its expiry date.

1. `[Home]` → «Додати» → `[Scanner]` opens straight away; «Ввести вручну» below.
2. a) **Barcode known** → `[Confirm medicine]` name, form, strength from the
      Register; expiry from DataMatrix if present.
   b) **Barcode unknown** → «Ми ще не знаємо цей код» with «Сфотографувати
      коробку» first and «Знайти вручну» next to it. A photo is read and turned
      into a `[Register search]` with the best match on top; she taps it, or
      searches herself → `[Confirm medicine]`. Next time the code is known.
   c) **Not in the Register** (supplements, foreign pack) → `[Medicine form]`
      by hand: name and expiry required, the rest optional.
3. On `[Confirm medicine]` she sets the expiry (month/year), or picks «Не знаю»
   when the date went with the box, and, optionally, quantity and tags. If the medicine is already in the cabinet, the app offers
   «Додати як нову упаковку».
4. Saves → `[Medicine]` of what she just added (an existing medicine: the new
   pack highlighted), with a short «Додано» toast and «Скасувати» in it for a
   few seconds (removes what was just added). «Нагадування» is one tap away
   there, so adding never asks about reminders. Until she leaves it, the
   footer there is «Додати ще» and «Готово» (→ Home), not «Прийняти». In the «Кілька поспіль» mode
   she stays on `[Scanner]` instead, a toast after each pack. The mode stays as she left
   it, the next time too.
5. Adding started from «Додати нагадування» (see J3) → `[New reminder]` for
   that medicine instead of `[Medicine]`; saving it ends on `[Medicine]`.

**Friction:** camera permission refused; bad light; same medicine added twice;
typing a full date when the pack only shows month/year; a loose blister with no
date. **Done when:** the pack is in the list with an expiry status (or
«Термін невідомий»).

## J3. Daily intake (home cabinet only)

**Trigger:** push at 09:00 «Сорбіфер · 1 таблетка». **Goal:** take it and not
think about stock.

1. Push with actions «Прийняти» / «Відкласти на 15 хв». She taps «Прийняти» from
   the lock screen; the app does not open.
2. The app records the intake and subtracts 1 from the pack expiring soonest.
3. If stock drops to the threshold → next morning push «Сорбіферу залишилось на
   3 дні» → opens `[Medicine]` with «Додати до списку покупок».
4. Missed dose → one repeat after the set interval, then it shows as missed in
   `[Today]`.

**Also:** opening the app, `[Home]` shows the next dose with a «Прийняти» button.

**Setting it up:** «Додати нагадування» (on `[Today]` or in «Перші кроки») →
`[Pick a medicine]` «Що нагадати прийняти?»: the cabinet's medicines, and «Додати
нові ліки» for one not added yet. A medicine → `[New reminder]`. «Додати нові
ліки» → the usual J2 adding, which then ends on `[New reminder]` for it, not on
`[Medicine]`: she came for the reminder, so the pills are not added twice and
the reminder is not forgotten. From `[Medicine]`, the «Нагадування» row opens
`[New reminder]` directly.

**Friction:** stock was never counted (quantity empty) → no low-stock warning,
which is fine; the person took it but forgot to tap → can mark it later in
`[Today]`. **Done when:** the dose is marked and the stock is right.

## J4. Something is expiring

**Trigger:** push «У «Дачі» через 30 днів закінчується термін: Називін».
**Goal:** decide what to do with it.

1. Push → `[Medicine]` in the Dacha cabinet, the pack highlighted.
2. Actions: «Утилізувати» (pack leaves the list), «Купити нову» (to the shopping
   list), «Нагадати пізніше».
3. Expired packs stay on top of `[Home]` with the same actions until handled.

**Friction:** a weekly digest is better than many separate pushes when several
packs expire (built: the Monday summary, a switch in Settings); she should be
able to turn these pushes off per cabinet (built: «Сповіщення про термін» on the cabinet screen). **Done
when:** no expired packs left without a decision.

## J5. Checking the parents' cabinet on a visit

**Trigger:** visiting her parents. **Goal:** throw out what is expired and know
what to bring next time.

1. `[Home]` → cabinet switcher in the title → «Батьки».
2. `[Home]` of that cabinet: expired on top, then expiring, then the rest.
   No intake section: the cabinet is `expiry_only`.
3. Goes through the box: «Утилізувати» on expired packs; scans packs that are
   not in the app yet (J2).
4. Adds what is missing to the shopping list.
5. Optional: invites a sibling who also helps the parents → cabinet settings
   → «Запросити» (or `[Members]` → «Запросити») → `[Invite]`: a six-character
   code to send in any messenger or read aloud. No account needed. The first
   invite shares the cabinet, so it needs the internet once; after that
   changes wait offline and go up later.

**Friction:** on the spot, fast scanning of many packs in a row matters more
than details; one hand, the box in the other. **Done when:** no expired packs,
shopping list ready.

## J6. "Is there anything for a headache?"

**Trigger:** headache, at the dacha. **Goal:** find a suitable medicine that is
not expired, in this cabinet or another.

1. `[Home]` → search «ібупрофен» or tag «Головний біль».
2. `[Search results]` across all cabinets, this one first, expired ones greyed
   out. «Нурофен» is found by its substance, ibuprofen.
3. Opens `[Medicine]` → «Інструкція» (from the Register) → «Прийняти».

**Done when:** she knows what she has and where.

## J7. Joining someone's cabinet

**Trigger:** her mother sent a message with an invite code. **Goal:** see
that cabinet.

1. `[Welcome]` → «У мене є запрошення», or the cabinet switcher →
   «Приєднатися за кодом» → `[Join code]`: six cells; a pasted message gives
   up its code. The sixth character looks it up.
2. `[Join]`: the cabinet, who invites, its counts, and «Як вас підписати для
   інших?» prefilled from Settings → «Приєднатися» → the cabinet is current,
   on Home. No account needed.
3. A code she already used opens that cabinet; a wrong one says so under the
   cells.

**Friction:** an expired code needs a clear message and «Попросити новий код»,
which sends a message asking for one.
**Done when:** the shared cabinet is in her switcher.

## J8. "Can I have a drink tonight?"

**Trigger:** a course of antibiotics ended yesterday, a party tonight. **Goal:**
know whether the medicine is still in the body and what the instruction says
about alcohol.

1. Opens the medicine from `[Home]` or search → `[Medicine]`.
2. At the bottom, under everything else, a note: when the last dose was, when it
   is gone from the body, whether it built up over the course, and the
   instruction's own words about alcohol (with the wait it names, if any).
3. The note never says "можна" or "не можна" by itself; the person decides, or
   asks a pharmacist.

**Friction:** intakes were not marked → the note gives the general time only
(«Виводиться приблизно за 2 доби»), not a date; the substance is not covered
yet → no note. **Done when:** she knows the date and the instruction's words.

## J9. Picked the wrong medicine

**Trigger:** she added «Нурофен» a week ago, with an expiry and a reminder;
now she sees the box says «Нурофен для дітей». **Goal:** the app shows the
medicine she really has, without typing everything again.

1. `[Medicine]` «Нурофен» → «⋯» → «Змінити ліки».
2. → `[Register search]` with the old name in the field, so «для дітей» is a
   few letters away. She taps «Нурофен для дітей». Not in the Register →
   «Ввести вручну»: name and form only.
3. → `[Change medicine]` old and new side by side, what changes (form,
   strength) and what stays («Упаковки і терміни залишаться»). «Змінити».
4. The form changed (tablets → suspension), so the numbers are asked again,
   one question per screen: quantity of each pack (in ml, or «Не рахувати,
   просто є»), then the dose for each reminder («Скільки мл за раз?»).
5. Already has «Нурофен для дітей» in this cabinet → step 3 offers «Об’єднати»
   instead: the packs and reminders move there.
6. → `[Medicine]` «Нурофен для дітей» with the same packs, a «Змінено» toast.

**One pack only:** two boxes went in as «Нурофен», and one is «Пантамак».
On `[Medicine]` she opens that pack → its «⋯» → «Це інші ліки» → the same
search → `[Change medicine]` titled «Це інші ліки»: what the pack becomes,
«Термін і кількість залишаться» and «Нурофен» залишиться». «Перенести» (or
«Об’єднати») → `[Medicine]` «Пантамак» with «Упаковку перенесено».

**Friction:** a reminder that keeps firing in the old unit (it waits for the
new dose instead); a barcode that keeps mapping to the wrong medicine (her
confirmation moves to the new pick); deleting and adding again, which loses
the expiry and the history. **Done when:** the medicine, its packs and its
reminders are right, and nothing was typed twice.

---

## Not in the first version

Kept here so they are not lost: shopping list sync between members, opened-pack
expiry for drops, OCR of printed expiry dates, history of intakes as charts,
exporting a medicine list for a doctor.

### Idea: a weekly pillbox (the owner, 2026-10-22)

A «День / Тиждень» switch on `[Today]`. The week looks like a real pillbox:
seven columns Пн–Нд, three rows «Ранок / День / Вечір», each cell with the
number of pills and small coloured dots for the medicines. Past days show what
was taken and what was missed; a tap on a cell says what goes into it. Under
it, the stock for the week («На тиждень потрібно 21 шт, є 14») with the
shortfall sent to the shopping list. Worth it when the schedule differs by
day (days of the week, a course ending mid-week) and for filling a real
pillbox on Sunday; for one daily pill it shows seven equal columns.
