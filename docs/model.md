# Data model

What the app stores and the rules that connect it. The screens follow from this
file, so change it first when the logic changes.

Data lives on the phone (expo-sqlite + Drizzle). Nothing needs an account until a
cabinet is shared; then that cabinet syncs through Supabase. The barcode map is
shared by all users from the start (see "Barcodes").

The phone signs in to Supabase **anonymously** on first launch, without asking
anything (decided 2026-10-15). That gives it an identity for the barcode map,
the photo limit and later sharing. Signing in with Telegram or Apple later
moves it into that account, so nothing is lost (see "Signing in").

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
| mode | `expiry_only` or `with_intake`. Home defaults to `with_intake`, the rest to `expiry_only`. Can be picked when the cabinet is created or changed later. |
| expiry_warning_days | When a pack counts as «Закінчується термін». Default 30. |
| expiry_push | Expiry notices and the weekly summary include this cabinet. On by default; off for a cabinet she only checks on visits. Home still shows its expired and expiring packs. |

A cabinet also keeps, on the phone, whether it is synced and the person's
role in it ("Syncing a shared cabinet").

The «Особиста / Сімейна» type from the Figma design is dropped: a cabinet is
shared when it has more than one member.

Switching a cabinet to `expiry_only` keeps its reminders and intakes but
silences them: no dose notifications, no «Сьогодні» tab while that cabinet is
on screen. Switching back brings them back as they were. Deleting a cabinet
deletes everything in it.

### Medicine

What the medicine is, independent of how many packs there are.

| Field | Notes |
|---|---|
| name | Required. Trade name, e.g. «Нурофен». |
| inn | Active substance, e.g. «ібупрофен». From the Register when linked. Lets search find «Нурофен» by «ібупрофен». |
| form | Tablets, capsules, drops, syrup, ointment, spray, powder, other; under «Інше» the Register's commoner other forms: solution, injection, suspension, suppositories, tincture, emulsion, herbs, patch (picked from tiles that open under «Інше», never typed). Plain «other» stays for the rest. Sets the stock unit and the strength units offered. |
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
| expires | Month and year, as printed on packs; stored as the last day of that month. Further away than the Register's shelf life from today → «Точно?», a likely typo. Empty only when she picks «Не знаю» (the box with the date is gone, a loose blister): the pack is then «Термін невідомий». Always asked for; there is no plain «Пропустити». |
| quantity | Optional. In the form's unit (pieces for tablets, ml for liquids). Empty = not counted, the pack is just "there". |
| opened_at | Never asked for tablets: set automatically when a pack is added with less than its full count (the date it was added), or on the first intake from it. Later, for drops and syrups that expire sooner once opened, the form asks for it, since it changes the expiry. |
| status | `active`, `used_up`, `disposed`. Used-up and disposed packs stay for history but leave the list. Disposing the last pack of a medicine that never ran out (no `used_up` pack) removes the medicine from the cabinet, with its reminders; the app asks first. One that ran out stays as «Закінчилось». |
| gtin | Optional. The barcode the pack was scanned from, as an EAN-13, so «Змінити ліки» can correct `barcode_map` (see "Changing what a medicine is"). Kept on the phone that scanned it, not synced. |

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
then one with an unknown expiry (likely the oldest), then the one that expires
soonest.

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
first launch can invite and join. Signing in is only offered, in Settings as
«Зберегти доступ» and on Welcome as «Повернути мої аптечки» (see "Signing
in"). Without it, a new phone loses the shared cabinets and the person has to
be invited again.

A person has a `name` that other members see. It is asked once, when joining
or first inviting («Як вас підписати для інших?»), and changed in Settings.
An invite is one code (6 letters and digits) inside a link; it works for 7
days and for any number of people. New members join as `member`.

| Role | Can |
|---|---|
| owner | Everything, including deleting the cabinet. |
| admin | Edit medicines and packs, invite people. |
| member | See the cabinet, change quantities, mark their own intakes. |

Joining is from a link, from Welcome («У мене є запрошення»), or from the
cabinet switcher, «Приєднатися за кодом» under «Додати аптечку» (the owner,
2026-10-24). In Expo Go a link cannot open the app, so «Поділитися
посиланням» sends a text with the code, and the code is typed.

Own categories used on a shared cabinet's medicines are seen by every member
(the owner, 2026-10-24): they come to the other phones with the medicines and
join their list of categories.

What a role allows is checked by the server; the phone hides what the role
cannot do.

## Syncing a shared cabinet

The same design as Freshka's (its `docs/sync.md`), cut down to what is shared.

**What goes to the server.** Only cabinets that are shared, and in them the
medicines, packs, their categories and the own categories those use. A cabinet
goes up whole the first time its owner opens «Запросити», and from then on it
stays synced, even if everyone else leaves. Personal cabinets, reminders,
intakes, the shopping list and the settings stay on the phone. A cabinet's
«Сповіщення про термін» is per phone too.

**Offline first.** Screens read and write only SQLite, as before. A change in a
synced cabinet also writes a row to a local `outbox`, in the same statement:
SQLite triggers write it, so no screen and no data function has to remember to.
A background worker sends the outbox in order, then brings the memberships,
then pulls what changed on the server since its cursors. It runs on start, on
return to the app, when the network comes back, two seconds after a change, and
on a Realtime nudge while the app is open. Rows a pull writes do not go back
into the outbox.

**Conflicts**, when two phones changed the same thing:

| Phone A | Phone B | After both sync |
|---|---|---|
| renamed the medicine | changed its strength | both changes |
| set the expiry to May | set it to June later | June: the later edit wins, by when the person made it |
| took 1 tablet of 10 | took 1 tablet of 10 | 8: a count travels as a change, floored at 0 |
| deleted the medicine | changed its pack | deleted |

- Per field, the later edit wins, by the phone's time of the edit, never later
  than the server's clock (a phone set a year ahead does not win for a year).
- A pack's quantity travels as `quantity_delta`; a bare quantity only when
  the pack starts or stops being counted.
- A deleted medicine stays deleted; only its owner's undo brings it back.

**Moving a medicine** between a synced and a personal cabinet is a delete on
one side and a whole insert on the other.

**Leaving or being removed.** A cabinet the server no longer lists for this
person goes from the phone, with whatever of it was still in the outbox.
«Видалити аптечку» by the owner deletes it for everyone (asks first); for
anyone else it is «Вийти з аптечки», and the cabinet stays for the rest.

**No network.** Nothing stops. Invite and join need the network, and say so.

**Identity.** The anonymous user of the first launch (see the top), or the
account it signed in to. Its name is a `profiles` row; the members list and
«Олена запрошує вас» read it.

## Signing in

Decided with the owner (2026-10-29):

- **With Telegram or Apple.** Telegram is the same account as the Telegram
  mini app (docs/telegram.md): email `tg<telegram id>@telegram.invalid`.
  Apple is there because the App Store asks for it beside another sign-in.
  Google and a phone number with a code are left for later (a code by SMS
  costs money and needs a provider).
- **Every cabinet goes to the server once signed in**, not only the shared
  ones: each is marked synced and goes up whole, as an invited one does, with
  the person as its owner; a cabinet made later follows. Reminders, intakes,
  the shopping list and the settings stay on the phone, as for a shared
  cabinet.
- **Into an account that has cabinets already**, the phone's are added to them:
  the server moves the phone's anonymous user into the account
  (`merge_account`: memberships with the stronger role, the name if the
  account has none, own categories, barcode picks) and deletes it. Nothing is
  overwritten.

How (`supabase/functions/sign-in`, `src/data/account.ts`):

1. Telegram on a phone is its Login Widget in the browser. The app opens the
   function, which sends the browser to oauth.telegram.org with the bot's id;
   Telegram comes back to `public/telegram-login.html` on the Worker (the
   bot's domain, set with /setdomain), which passes the signed result to the
   app at `/signed-in`. Only the app's own schemes (`exp`, `medkit`) are
   followed.
2. Apple is its own sheet; the token goes to the function with its nonce.
3. The function checks Telegram's signature (or has GoTrue check Apple's
   token), merges the caller's anonymous user into the account, and answers
   with a session: a one-time token for Telegram, the session itself for
   Apple.
4. Sync waits while this runs: a cycle as the account before the merge would
   find none of the phone's cabinets and drop them.

There is no signing out yet.


## Notifications

All are scheduled on the phone, one-off, and laid out again on every start,
every return to the app and every change that touches them. iOS keeps at most
64, so 60 are used: a notice for each of the 8 packs whose date comes soonest,
the weekly summary, then doses in time order.

- **Dose:** at each reminder time of a `with_intake` cabinet, for 7 days ahead.
- **Missed dose:** one repeat, `missed_repeat_minutes` after the dose (default
  15, can be off), unless the dose is marked taken first. Never past midnight.
- **Expiry:** at 09:00, `expiry_notice_days` before a pack's date (default 30).
  A notice whose day has passed is not sent late: the pack is on Home anyway.
- **Monday expiry summary** («Терміни щопонеділка», switch, on by default): Monday 09:00, how many packs are
  expired and expiring by then. Not sent when there are none.
- **Shopping:** see "Shopping list".

The person's settings (name, the two numbers, the summary switch) are kept on
the phone, not per cabinet. Permission is asked on the first saved medicine,
reminder or ticked shopping line, whichever comes first.

`expiry_notice_days` (the push) and the cabinet's `expiry_warning_days` (when
Home shows «Закінчується термін») are separate on purpose: a parents' cabinet
can warn 60 days ahead while the push still comes 30 days before.

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

In the same unit the numbers stay, except a pack that cannot be the new
pick's: a whole pack holding none of the Register's pack sizes for it, or any
pack holding more than the largest (100 tablets left from the wrong pick,
where the new one comes by 10 or 20). Its quantity is asked again, with the
new pick's pack sizes as tiles.

If the new pick is already in this cabinet, the app offers to join them: the
packs, reminders and intakes move to the existing medicine and this one is
deleted. The dose question still applies when the units differ. A medicine
has one reminder, so when both have one, the one already there stays and the
moved one is dropped (the comparison says «Нагадування буде як у «…»»).

If a pack was added by barcode (`gtin` set), the pair in `barcode_map` was
wrong too. The person's pick is one row per code, so the change replaces it:
the code now points to the new Register entry, or, changed to a medicine
typed by hand, to its name and form. Only the packs this phone scanned carry the code, so a
member who changes a medicine scanned on another phone corrects nothing.

**One pack of several** (the owner, 2026-10-29): two boxes were added as
«Нурофен», and one of them is really «Пантамак». The open pack has its own «⋯»
with «Це інші ліки» (only when the medicine has more than one pack; with one,
it is «Змінити ліки»). The same search, then the comparison titled «Це інші
ліки»: the pack leaves for a medicine the cabinet already has («Об’єднати»),
or for a new one made from the pick («Перенести»). Its date and count go with
it, its quantity is asked again when the unit changes; the reminder, the
intakes and the tags stay with the medicine it left. Its code learns the new
pick. Ends on the medicine it went to, with «Упаковку перенесено».

Only those who can edit medicines (owner, admin) see «Змінити ліки».

**Right after adding**, the «Додано» toast has «Скасувати» for a few seconds:
it removes the pack just added, and the medicine too if it was new (then its
screen closes and she is back where adding started). A wrong
pick noticed later is fixed by «Змінити ліки», not by deleting and adding
again, which loses the expiry, the quantity, the reminders and the history.

## Moving a medicine

A medicine added to the wrong cabinet is moved from «Деталі», row «Аптечка»
(«Де лежить»). It goes with its packs, tags, intakes and shopping lines. Into
an `expiry_only` cabinet the reminder is deleted, and the picker says so
first («Нагадування вимкнеться»). If the target cabinet already has the same
medicine (same Register id, or the same name), the two are joined as in
«Змінити ліки»: the one already there keeps its reminder. Only those who can
edit medicines in both cabinets can move one.

## Derived statuses

Computed, never stored. One pack has exactly one expiry status; a medicine shows the
worst of its active packs.

| Status | Rule | Colour in the design |
|---|---|---|
| Протерміновано | `expires < today` | red |
| Закінчується термін | `expires <= today + expiry_warning_days` | amber |
| Термін невідомий | `expires` is empty | grey, with «Вказати термін» |
| Добрий | otherwise | green / neutral |

Worst first: Протерміновано, Закінчується термін, Термін невідомий, Добрий. An
unknown expiry is not counted as expired and puts nothing on the shopping list;
it sits in «Потребує уваги» on Home until a date is set or the pack is gone.
Once such a pack has been in the cabinet longer than the Register's shelf life,
its line reads «Термін невідомий, додано 3 роки тому», so she can decide to
throw it out.

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
«Взаємодія з іншими лікарськими засобами», «Особливості застосування»). One
instruction per INN (a tablet or capsule one first) is downloaded and turned into
text, two reviewers pull the fields out apart from each other, and a row ships
(`src/domain/substances.ts`) once they agree and every quote is found in the
instruction word for word.

A medicine with several substances uses the longest half-life and the strictest
alcohol rule of them. No row, or no half-life in the instruction: the block is
simply not shown. The app never guesses a number.

### Rules

Computed from the person's own `taken` Intakes (reminders and «as needed» alike).
With no marked dose (any `expiry_only` cabinet, or nothing marked yet) the block
gives only the general time: «Виводиться приблизно за 2 доби».

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

### Decided (2026-10-29)

- Not everyone wants it: a Settings switch «Час в організмі й алкоголь» under
  «Ліки», off until turned on. Not asked in the first steps.
- Launch rows: the 44 commonest substances in home cabinets (pain and fever,
  allergy, antibiotics, stomach, cough, sleep and nerves, heart and pressure,
  sugar, cholesterol). Where the first instruction had no half-life, another
  maker's was used. A prodrug (metamizole, oseltamivir) takes its active
  metabolite's half-life. More come in batches.
- A half-life given as a mean with a range («приблизно 11 годин (діапазон 9–14)»)
  is the mean: the range is the spread between people, and its top would make a
  common medicine look like it stays for weeks.

## No proven effect

Asked by the owner on 2026-10-29: a way to find the medicines with no proven
effect (Арбідол, Анаферон, homeopathy). Some people trust them, and the app
must not shame them; others want to know.

### EvidenceNote

Per active substance (INN), like SubstanceFacts, shipped with the app. Homeopathy
has no INN and the Register has no field for it, so it is told by the Register's
own words: no ATC code, and dilutions in the composition («D6», «C30», «200К»)
or «гомеопатичн» in it or the form. In the Register of 2026-10-24 that is 184
products, Анаферон, Ергоферон and Тенотен among them. Only medicines added from
the Register are marked.

| Field | Notes |
|---|---|
| inn | Key, or `homeopathy` for every homeopathic product. |
| names | Trade names, only for a product the Register files under «Mono» with no INN (Церебролізин, Актовегін). |
| source | Link to the review that found no proven effect (Cochrane, WHO, a national formulary). One per row; no row without one. |
| source_name | What the row shows: «Cochrane», «ВООЗ». |
| reviewed | A person has checked the row against the source. Unreviewed rows are not shipped. |

The list is ours, short and kept by hand. A substance gets a row only when a
review says the effect is not shown, never because it is merely unknown.

### Rules

- **Off by default.** Nothing about it shows until the person turns it on.
- **A personal setting, not a cabinet one.** It lives on the phone with the other
  preferences and is never synced: in a shared cabinet each member decides for
  themselves, so marking the parents' cabinet shows nothing on the parents' phones.
- **Asked once** as the last of the first steps («Позначати ліки без доведеної
  дії?», «Позначати» / «Не треба», the two buttons of equal weight), never when a
  marked medicine is added, so the question is about the person's preference and
  not about their medicine. The switch stays in Settings.
- **When on:** a search tile «Без доведеної дії» after the categories (only when
  some medicine has it), and a grey chip «Дію не доведено» by the category chips on
  the medicine screen that opens the source. No colour of its own, no warning icon, no count on Home, no
  push.
- The words are facts, not judgement: never «фуфломіцин», «марні», «не працює».

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
2. The barcode is looked up in a shared Supabase table `barcode_map`: one row
   per person and code (gtin, user, register entry or a typed name and form,
   pack size), their latest
   pick, read and written only through `lookup_barcode` and
   `confirm_barcode`, so nobody sees who picked what. A lookup gives the entry
   most people picked, the asker's own pick first.
3. On a miss, the user picks the medicine once (box photo or the Register
   search) and adds it; the pair is saved for everyone. Another person's pair
   is trusted at once for now, while users are few (the owner, 2026-10-29);
   later, after two people picked it. One's own pick counts at once. The phone
   also keeps its own picks, so a code once added works offline.
   The pack size is saved only when the quantity added is one of the
   Register's pack sizes, a full pack.
   A medicine the Register lacks, added by hand after a scan, saves the code
   with its name and form. Typed names count as one pick when they match in
   any case. The next scan of such a code opens the steps with the name and form
   filled in, or, when the cabinet has a medicine of that name, adds a pack
   to it.
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
