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
```

### Cabinet

A place where medicines are kept: home, car, dacha, parents'.

| Field | Notes |
|---|---|
| name | Prefilled from the place: «Дім», «Машина», «Дача», «Батьки». |
| place | `home`, `car`, `dacha`, `parents`, `other`. Picks the icon and the default mode. |
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

A person exists locally without an account. Signing in (Apple, Google, phone)
happens when they invite someone or join a cabinet.

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
