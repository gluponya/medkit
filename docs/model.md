# Data model

What the app stores and the rules that connect it. The screens follow from this
file, so change it first when the logic changes.

Data lives on the phone (expo-sqlite + Drizzle). Nothing needs an account until a
cabinet is shared; then that cabinet syncs through Supabase. The barcode map is
shared by all users from the start (see "Barcodes").

The phone signs in to Supabase **anonymously** on first launch, without asking
anything (decided 2026-10-15). That gives it an identity for the barcode map,
the photo limit and later sharing; an email or Apple sign-in can be linked to
the same user later, so nothing is lost.

## Entities

```
Cabinet ──< Medicine ──< Package
                │
                └──< Reminder ──< Intake ──> Package (stock goes down)
Person ──< Reminder
Cabinet ──< Membership >── Person      (only for shared cabinets)
Medicine >── RegisterEntry             (optional link to the State Register)
Medicine >──< SubstanceFacts           (by INN: half-life, alcohol note)
```

### Cabinet

A place where medicines are kept: home, car, dacha, parents'.

| Field | Notes |
|---|---|
| name | Prefilled from the place: «Дім», «Машина», «Дача», «Батьки». |
| place | `home`, `car`, `dacha`, `parents`, `other`. Picks the icon and the default mode. |
| icon | One of twelve line icons. Defaults from the place (Інше: a first-aid kit); can be picked when the cabinet is created or later. |
| mode | `expiry_only` or `with_intake`. Home defaults to `with_intake`, the rest to `expiry_only`. Can be changed. |
| expiry_warning_days | When a pack counts as «Закінчується термін». Default 30. |

The «Особиста / Сімейна» type from the Figma design is dropped: a cabinet is
shared when it has more than one member.

### Medicine

What the medicine is, independent of how many packs there are.

| Field | Notes |
|---|---|
| name | Required. Trade name, e.g. «Нурофен». |
| inn | Active substance, e.g. «ібупрофен». From the Register when linked. Lets search find «Нурофен» by «ібупрофен». |
| form | Tablets, capsules, drops, syrup, ointment, spray, powder, other. Sets the stock unit. |
| strength | «200 мг», «0.05%». Free text. |
| manufacturer | Optional. |
| tags | Categories as tags, several per medicine, the way people look for medicines in a pharmacy: «Серце і судини», «Знеболювальні», «Від алергії»… Set from the Register's ATC code through our own ATC → category table; can be changed. |
| rx | Prescription only. From the Register's «Умови відпуску» when linked. Low stock then reminds «не забудьте рецепт». |
| register_entry | Optional link to the State Register: instruction link, full form text, shelf life. |
| low_stock_threshold | Optional, in stock units. Empty means "no low-stock warning". |

### Package

One physical pack. Two packs of the same medicine can have different expiry dates.

| Field | Notes |
|---|---|
| expires | Required. Month and year, as printed on packs; stored as the last day of that month. Further away than the Register's shelf life from today → «Точно?», a likely typo. |
| quantity | Optional. In the form's unit (pieces for tablets, ml for liquids). Empty = not counted, the pack is just "there". |
| opened_at | Never asked for tablets: set automatically when a pack is added with less than its full count (the date it was added), or on the first intake from it. Later, for drops and syrups that expire sooner once opened, the form asks for it, since it changes the expiry. |
| status | `active`, `used_up`, `disposed`. Used-up and disposed packs stay for history but leave the list. |

### Reminder (only in `with_intake` cabinets)

Belongs to a person, not to the cabinet. Other members of a shared cabinet do not
see it.

| Field | Notes |
|---|---|
| person, medicine | Who takes what. |
| times | List of `{time, dose}`, e.g. 08:00 × 1, 20:00 × 1. |
| schedule | `daily`, `weekdays`, `days_of_week [..]`, `every_n_hours`, `as_needed`. |
| course | `ongoing`, or `{start, days}`. |

### Intake

One event: a dose taken, skipped, or (for `as_needed`) taken without a reminder.
`taken` subtracts `dose` from a package of that medicine: an opened one first,
then the one that expires soonest.

A snooze («Пізніше» in the app, «Відкласти на 15 хв» in the push) is not an
Intake: the dose stays open, the push comes again 15 minutes later, and the
next-dose card says «Нагадаю о 13:15». It can be snoozed again. A dose not
taken by the next dose of the same medicine (or by the end of the day) is
recorded as `skipped` and shows as missed.

### Person and Membership (shared cabinets only)

Sharing needs no account (decided 2026-10-22): the anonymous user from the
first launch can invite and join. Signing in (Apple, Google, phone) is only
offered, in Settings and once after joining or inviting, as «Зберегти доступ
на новому телефоні». Without it, a new phone loses the shared cabinets and the
person has to be invited again.

A person has a `name` that other members see. It is asked once, when joining
or first inviting («Як вас підписати для інших?»), and changed in Settings.
An invite is one code (6 letters and digits) inside a link; it works for 7
days and for any number of people. New members join as `member`.

| Role | Can |
|---|---|
| owner | Everything, including deleting the cabinet. |
| admin | Edit medicines and packs, invite people. |
| member | See the cabinet, change quantities, mark their own intakes. |

## Derived statuses

Computed, never stored. One pack has exactly one expiry status; a medicine shows the
worst of its active packs.

| Status | Rule | Colour in the design |
|---|---|---|
| Протерміновано | `expires < today` | red |
| Закінчується термін | `expires <= today + expiry_warning_days` | amber |
| Добрий | otherwise | green / neutral |

Stock status is separate and only exists when quantity is counted:

| Status | Rule |
|---|---|
| Закінчується | sum of active packs' quantity `<= low_stock_threshold` |
| Закінчилось | sum is 0 |

The home counters «В наявності / Закінчується / Протерміновано» from Figma mix
the two. They become: «Протерміновано», «Скоро закінчиться термін», «Мало
залишилось», each a filter of the list. "В наявності" is just the whole list.

## Time in the body and alcohol

Asked by the owner on 2026-10-22: how long a medicine stays in the blood, whether
it builds up, when it is gone, and so whether alcohol is safe.

### SubstanceFacts

Per active substance (INN), not per trade name: «Нурофен» and «Ібупрофен-Дарниця»
share one row. Shipped with the app next to the Register index.

| Field | Notes |
|---|---|
| inn | Key. |
| half_life_hours | `{min, max}`, as the instruction gives it. Many give a range. |
| metabolite_half_life_hours | Optional. Some active metabolites stay far longer than the drug (fluoxetine: days for the drug, up to two weeks for norfluoxetine). |
| alcohol | `forbidden`, `avoid`, `caution`, `not_mentioned`. |
| alcohol_wait_hours | Optional. Only when the instruction names a wait after the last dose (metronidazole: 48 h). |
| alcohol_quote | The instruction's own sentence about alcohol, verbatim. |
| source | Link to the instruction the facts come from. |
| reviewed | A person has checked the row against the source. Unreviewed rows are not shipped. |

The Register CSV has none of this. It is in the instruction text («Фармакокінетика»,
«Взаємодія з іншими лікарськими засобами», «Особливості застосування»), which is
already turned into text on the server. A model pulls the fields out once per INN;
a person then reviews each row before it ships.

A medicine with several substances uses the longest half-life and the strictest
alcohol rule of them. No row, or no half-life in the instruction: the block is
simply not shown. The app never guesses a number.

### Rules

Computed from the person's own `taken` Intakes (reminders and «as needed» alike),
so only in `with_intake` cabinets and only for what was actually marked.

- **Last dose**: the latest `taken` Intake of the medicine.
- **Gone by**: last dose + 5 × the longest half-life (drug or metabolite), using
  `max` of the range. After 5 half-lives about 97% is gone. Shown as a date and
  time, rounded up.
- **Builds up**: when the medicine was taken regularly and the gap between doses
  is shorter than the half-life, the level grows over about 5 half-lives and then
  holds. The «gone by» rule stays the same (it counts from the last dose), but the
  screen says the medicine builds up, so a long course is not read as "one pill".
- **Alcohol** is a separate answer, never derived from «gone by»:
  - `alcohol_wait_hours` set: wait until the later of «gone by» and last dose +
    that wait;
  - `forbidden` / `avoid` / `caution`: the instruction's quote, plus «gone by»;
  - `not_mentioned`: says the instruction says nothing about alcohol, and that a
    pharmacist can tell.
- The app never shows "можна пити" or a green "safe". It shows dates and the
  instruction's words. Half-life differs with age, liver and kidneys, so every
  such block carries one short line saying the numbers are averages from the
  instruction.

### Decided (2026-10-22)

- Launch covers only the substances people usually keep at home (a few hundred:
  pain and fever, colds, allergy, stomach, antibiotics, heart and pressure,
  sleep and nerves, vitamins). Others get rows later.
- No separate question or button: it is a quiet note at the bottom of the
  medicine screen (see `docs/screens.md`, Medicine).

## Barcodes

There is no open barcode→medicine dataset for Ukraine (research, 2026-10-15):

- The State Register of Medicinal Products (data.gov.ua, CC-BY, CSV in cp1251)
  has names, INN, composition, forms with pack sizes (free text), ATC codes,
  manufacturers, registration numbers, Rx flag, shelf life and instruction
  links (mostly `.mht`), but **no barcodes**. It ships inside the app as a
  search index. The January 2026 file has 12,511 active medicines (7,712
  names); a first rough parse fills the form for 92% of them, the strength for
  99% and the pack size for 93%.
- Barcode catalogs exist only commercially (Morion, Proxima Research).
- DataMatrix codes (GTIN + batch + **expiry**) become mandatory only from
  1 Jan 2028; some packs already carry them.

So:

1. The scanner reads EAN-13 and GS1 DataMatrix. From a DataMatrix it also takes
   the expiry date.
2. The barcode is looked up in a shared Supabase table `barcode_map(gtin →
   register entry, pack size, confirmations)`.
3. On a miss, the user picks the medicine from the Register search once; the
   pair is saved for everyone and trusted after several matching confirmations.
4. "Code not found" is a normal path, not an error: it offers a photo of the
   box first and the search next to it.

### A photo of the box

As in Freshka (`supabase/functions/recognise-photo` there): an Edge Function
sends the photo to a vision model and gets back what is printed on the box —
name, strength, form, pack size, manufacturer and, from a second photo of the
flap, the expiry. The model's answer is never stored as the medicine: it is a
query for the Register search, and the person confirms the entry it finds. The
confirmed pair goes into `barcode_map` like a hand-picked one.

The function takes only the anonymous (or full) user's session and counts the
photos per user per day, so nobody can spend the model's money from outside.
A few photos are free, then the photo is paid (the owner, 2026-10-15),
probably as a one-time purchase rather than a subscription; the price is open.
The daily limit stays as a guard against abuse.

The Register's instructions are mostly `.mht` files, which an iPhone does not
open; they are turned into text once on the server.
