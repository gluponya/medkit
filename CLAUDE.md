# New app (working name)

A mobile app built from a design the owner made in Figma. The plan: improve the
design first, then build the app from it.

Status: the folder is empty. Nothing is decided yet beyond the stack.

## The design

- The owner's Figma screens are exported as PNG into `design/figma/`. That is the
  starting point; read them before proposing anything.
- **Never open or start Figma** (the app, a plugin or anything that launches it):
  it holds a lot of memory while open. Work from the exported files.
- Improved designs and variants are drafted in **Superdesign**, in a project of
  this app's own, never in Figma. A PNG of each sheet goes to
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
