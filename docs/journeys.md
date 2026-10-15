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

1. Opens the app → `[Welcome]` one line about the app, «Почати» and a quiet
   «У мене є код запрошення».
2. «Почати» → `[Where is the cabinet]` Дім / Машина / Дача / Батьки / Інше.
   Picks «Дім». The name and mode (`with_intake`) are set from it.
3. → `[Quick fill]` popular medicines as a checklist, plus «Сканувати» and
   «Знайти». She ticks the ones she has.
4. For each ticked medicine the app needs an expiry date → `[Expiry for picked]`
   a compact list: name + month/year picker. «Не знаю» is allowed and marks the
   pack «перевірити термін».
5. → `[Home]` with her medicines. Expired ones are already on top.

**Friction:** a long setup before any value (the Figma flow had 8 screens);
asking for an account; asking for categories; adding sample medicines she does
not have. **Done when:** she sees her real medicines with their status. Target:
under 2 minutes, no account, no keyboard if she picks from the list.

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
3. On `[Confirm medicine]` she sets the expiry (month/year) and, optionally,
   quantity and tags. If the medicine is already in the cabinet, the app offers
   «Додати як нову упаковку».
4. Saves → back where she came from, with a short «Додано» toast.

**Friction:** camera permission refused; bad light; same medicine added twice;
typing a full date when the pack only shows month/year. **Done when:** the
pack is in the list with an expiry status.

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
packs expire; she should be able to turn these pushes off per cabinet. **Done
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
5. Optional: invites a sibling who also helps the parents → `[Members]` →
   «Запросити» → here the app asks to sign in (Apple / Google / phone) →
   `[Invite]` link with the code.

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

**Trigger:** her mother sent an invite link. **Goal:** see that cabinet.

1. Link opens the app (or the store, then the app) → `[Join]` cabinet name and
   who invited → «Приєднатися» → sign in → the cabinet appears in the switcher.
2. Without the link: `[Welcome]` → «У мене є код запрошення» → code field.

**Friction:** an expired code needs a clear message and «Попросити новий код».
**Done when:** the shared cabinet is in her switcher.

---

## Not in the first version

Kept here so they are not lost: shopping list sync between members, opened-pack
expiry for drops, OCR of printed expiry dates, history of intakes as charts,
exporting a medicine list for a doctor.
