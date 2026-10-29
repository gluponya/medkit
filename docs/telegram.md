# Medkit as a Telegram mini app

The same app, built for the web (`npx expo export -p web`) and opened inside
Telegram from **t.me/medkitapp_bot/app**, served at
medkit.nb-77d18a.workers.dev. As Freshka's (`freshka-telegram/docs/telegram.md`), which this
follows.

## The web build

- `index.web.js` is the web entry: it sets up the Telegram shell, then opens
  the database once asynchronously before requiring the app. On the web
  SQLite runs in a worker that loads its wasm first, and a synchronous call
  times out after a few milliseconds while it does.
- One page at a time holds the database. The page opened last takes it over
  (a Web Lock and a BroadcastChannel in `index.web.js`), and the one before
  goes to `public/elsewhere.html`: «Аптечка відкрита в іншому вікні». On a
  computer Telegram can keep the app's last page alive behind a new one, and
  the new one could not open the database at all.
- Where the web view has no private file system (no `navigator.storage`, or
  no sync access to a file), SQLite's files are kept in memory
  (`src/data/db/web/AccessHandlePoolVFS.ts`, put in expo-sqlite's worker by
  `metro.config.js`). They are gone when the page closes; in Telegram
  everything comes down from the server again.
- Files with `.web.ts(x)` replace their neighbour on the web:
  `src/data/notifications.web.ts` (a page sends no notifications; in Telegram
  they are to be the bot's messages) and `src/ui/FitText.web.tsx` (the web's
  Text has no `onTextLayout`).
- The web SQLite has no FTS5, so `searchRegister` ranks the Register in
  memory there (`rankEntries` in `src/domain/register.ts`), with the same
  column weights as the phone's `bm25`.
- `npm run preview` builds and serves it locally (wrangler dev);
  `npm run deploy` builds and publishes it.

## Hosting

Cloudflare Workers, static assets from `dist` (`wrangler.jsonc`). The page is
served with COOP `same-origin` and COEP `require-corp` (`public/_headers`):
expo-sqlite's worker needs `SharedArrayBuffer`, which a page gets only when
isolated. Because of COEP, nothing is loaded from telegram.org: the few
messages the app sends Telegram are spoken directly (`src/ui/telegram-shell.ts`).

## Talking to Telegram

At start: `web_app_ready`, `web_app_expand`, vertical swipes off (a drag down
in a list would otherwise close the app), and Telegram's header, background
and bottom bar in the app's colours. The launch parameters are read from the
address's hash before the router can rewrite it.

## Signing in

The phone signs in anonymously on the first share or join
(`signedIn` in `src/data/remote/client.ts`). Inside Telegram it signs in with
the person's Telegram account instead, so it is the same account on every
device:

1. The app sends Telegram's signed launch data (`tgWebAppData`) to the Edge
   Function `telegram-signin`.
2. The function checks the signature with the bot's token
   (`TELEGRAM_APP_BOT_TOKEN`), refuses data older than a day, makes the
   account the first time (email `tg<telegram id>@telegram.invalid`, never
   written to) and answers with a one-time magic-link token.
3. The app turns the token into a session (`verifyOtp`).

«Зберегти доступ» is not shown inside Telegram.

## Functions from a browser

A page's request to the functions is preceded by a CORS preflight. Every
function the app calls is wrapped in `withCors`
(`supabase/functions/_shared/cors.ts`); a new one needs the same.

## Launching it

1. A bot from @BotFather, and a mini app on it (`/newapp`) with the Worker's
   address.
2. The bot's token as the functions' secret `TELEGRAM_APP_BOT_TOKEN`, set off
   stream, never printed.
3. `npx supabase functions deploy telegram-signin recognise-box`,
   then `npm run deploy`.

## Still to do

Reminders and expiry notices as the bot's messages, invitations as `startapp`
links (now a code is shared as text), a barcode scanner in JS (the camera
screen shows «Камеру вимкнено»), Telegram's back button. The data lives in the
page's storage; a cabinet that is not shared does not move to another device.
