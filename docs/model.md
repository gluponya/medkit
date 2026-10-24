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

## On the phone: two databases

- `medkit.db`: the person's own data (cabinets, medicines, packs, tags, later
  reminders and intakes). Read and written; its schema changes only through
  migrations (`src/data/db/schema.ts`, `src/data/db/migrations/`).
- `register.db`: the State Register, read only. Built from the Register's CSV
  by `tools/build-register.mjs` into `assets/register.db` and shipped with the
  app; a new app version replaces the copy on the phone whole, without
  migrations. A medicine points into it by `register_id`. Later
  `substance_facts` and the ATC → category table may move there too; for now
  the ATC table is code (`src/domain/categories.ts`).

The October 2026 file has 11,861 medicines in force (not expired, not
cancelled, not bulk substances), about 10 MB. Search is SQLite FTS5 over the
name, the international name and the composition, every word a prefix. The
Register writes the international name in Latin («Ibuprofen»); the Ukrainian
one is only in the composition, declined («ібупрофену»), which the prefix
match covers. «є/е», «і/и», «ґ/г» and the Russian letters are folded, so
«нурофен» finds «Нурофєн» and «ибупрофен» finds «ібупрофен».

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
| tags | Categories as tags, several per medicine, the way people look for medicines in a pharmacy: «Серце і судини», «Знеболювальні», «Від алергії»… Set from the Register's ATC code through our own ATC → category table; can be changed. Stored in `medicine_categories`: a built-in key (`src/domain/categories.ts`) or the id of an own category (`custom_categories`, kept per phone, so it is there in every cabinet). |
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
| gtin | Optional. The barcode the pack was scanned from, so «Змінити ліки» can correct `barcode_map` (see "Changing what a medicine is"). |

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

### Shopping list

One list on the phone over all cabinets; each line says which cabinet it is
for. Not shared with other members yet.

Most lines are derived, never stored: a medicine is on the list when it has
nothing good left to take.

| Reason | Rule | Shown as |
|---|---|---|
| Протерміновано | it has active packs and all of them are expired | red «Протерміновано» |
| Закінчилось | no active packs, and at least one was used up (not disposed) | amber «Закінчилось» |
| Мало | counted stock of its unexpired packs `<= low_stock_threshold` | amber «Залишилось 4 шт» |

A stored `ShoppingItem` is kept only for what cannot be derived:

| Field | Notes |
|---|---|
| cabinet | Where the bought pack goes. |
| medicine | Optional. Set by «Купити нову» on a pack and by ticking a derived line. |
| name | For a line added by hand («Пластир»); copied from the medicine otherwise. |
| bought_at | Set when ticked; the line moves to «Додати в аптечку». Unticking clears it; a ticked derived line is then deleted. |
| dismissed_at | Set by × on a medicine's line: it stays off the list until a new pack of it is added. «Купити нову» clears it. |

A line is done, and its row deleted, once the cabinet gets what was bought:
for a line with a medicine, a pack of it added after the row was made; for a
line by hand, a medicine of the same name added after it. A ticked line stays
until then or until it is crossed out; × on a line by hand deletes its row.

Ticking a line schedules one notification to add the pack, two hours later or
at 10:00 the next morning if that falls between 21:00 and 9:00. It is cancelled
when the line is unticked, crossed out or done.

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

## Changing what a medicine is

Asked by the owner on 2026-10-24: she added «Нурофен», and it turned out she
has «Нурофен для дітей». These are different Register entries: another form
(suspension, not tablets), another strength (100 мг/5 мл), maybe other tags
and another instruction. Renaming would leave the old Register link, the form
and a reminder dose in tablets.

So a medicine has two kinds of change:

- **Details** (`[Medicine details]`): a typo in a hand-typed name, the
  manufacturer, tags, the threshold, Rx. The Register link stays.
- **«Змінити ліки»** (in «⋯»): the medicine is picked again, from the same
  Register search as when adding, or typed by hand (name and form). It is the
  same physical box; only the pick was wrong.

| Kept | Taken from the new pick |
|---|---|
| Packs: expiry, status, opened_at | name, inn, form, strength, manufacturer, rx, register_entry |
| Intakes (they happened) | Tags from the ATC table; own categories the person added stay |
| Reminders: times, schedule, course | SubstanceFacts follow the new inn by themselves |

When the stock unit changes (tablets → ml), numbers in the old unit mean
nothing in the new one, and the app never converts them:

- each pack's quantity is asked again, as in adding by hand («Не рахувати,
  просто є» allowed);
- `low_stock_threshold` is cleared;
- each reminder's dose is asked again, and the reminder sends no push until
  it is answered.

If the new pick is already in this cabinet, the app offers to join them: the
packs, reminders and intakes move to the existing medicine and this one is
deleted. The dose question still applies when the units differ.

If a pack was added by barcode (`gtin` set), the pair in `barcode_map` was
wrong too: the change withdraws this phone's confirmation of the old pair and
confirms the new one. A pair nobody confirms any more is not trusted.

Only those who can edit medicines (owner, admin) see «Змінити ліки».

**Right after adding**, the «Додано» toast has «Скасувати» for a few seconds:
it removes the pack just added, and the medicine too if it was new. A wrong
pick noticed later is fixed by «Змінити ліки», not by deleting and adding
again, which loses the expiry, the quantity, the reminders and the history.

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
