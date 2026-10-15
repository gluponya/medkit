# Medkit (working name)

A home medicine cabinet app («Аптечка»): the medicines at hand, their expiry,
intake reminders, a cabinet shared with family. Built from a design the owner made
in Figma. The plan: improve the design first, then build the app from it.

Status: preparation only — the design is exported, no code yet. The rest is done
live on the owner's stream.

- UI languages at the start: Ukrainian and English (the Figma texts are Ukrainian).
- Public repo: https://github.com/gluponya/medkit. The owner streams the work, so
  never print secrets, `.env*` values or tokens to the screen, not even partly.

## The design

- The owner's Figma screens are exported as PNG into `design/figma/` (with
  `index.json` listing pages, names and sizes). That is the starting point; read
  them before proposing anything. To refresh them:
  `node --env-file=.env.local tools/figma-export.mjs [scale]` — it goes through
  the Figma REST API with `FIGMA_TOKEN` and `FIGMA_FILE_KEY` from `.env.local`.
- **Never open or start Figma** (the app, a plugin or anything that launches it):
  it holds a lot of memory while open. Work from the exported files.
- Improved designs and variants are drafted in **Superdesign**, in a project of
  this app's own, never in Figma: the project «Medkit»
  (`0232bd6f-53be-464b-844e-deeb5ec0616c`), the plugin enabled in
  `.claude/settings.json`. A PNG of each sheet goes to
  `C:\joskii-vibecoding\previews\<topic>-<date>` as well.

## The stack

The same as the sibling project `C:\joskii-vibecoding\cutie-patootie-fridge`
(Freshka), so its setup and solutions can be reused:

Expo + React Native + TypeScript; a local expo-sqlite + Drizzle database if the
app keeps data; Supabase as the backend only if it needs one. Versions in use
there on 2026-10-14: expo ~57, react-native 0.86, react 19.2, typescript ~6.0,
@shopify/react-native-skia 2.6 (only if the app draws its own graphics).

The owner checks builds on her own iPhone in Expo Go, not on an emulator.

## Rules

- The language of the code, identifiers and docs is English; talk to the owner
  in Russian.
- Secrets are never committed and never written to the owner in plain text.
- Questions to the owner go as plain text, not as answer buttons.
