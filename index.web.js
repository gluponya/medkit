import '@expo/metro-runtime';
import * as SQLite from 'expo-sqlite';

import { setUpTelegramShell } from './src/ui/telegram-shell';

// First, before the load: inside Telegram a drag down would otherwise close the app.
setUpTelegramShell();

// For now, while the web build is new: an error that breaks the page is shown
// on it, since a phone's Telegram has no console to read it in.
function showError(error) {
  const box = document.getElementById('web-error') ?? document.body.appendChild(document.createElement('pre'));
  box.id = 'web-error';
  box.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;max-height:60%;overflow:auto;margin:0;padding:12px;z-index:99999;' +
    'background:#fff;color:#b00020;font:12px/1.4 monospace;white-space:pre-wrap;border-top:2px solid #b00020';
  // Safari's stack leaves the message out.
  const text = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  box.textContent += text.slice(0, 1500) + '\n\n';
}
window.addEventListener('error', (e) => showError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));
const consoleError = console.error;
console.error = (...args) => {
  showError(args.map((a) => (a instanceof Error ? a.stack || a.message : String(a))).join(' '));
  consoleError(...args);
};

// On the web SQLite runs in a worker that first loads its wasm, and a synchronous
// call gives up after a few milliseconds of waiting (Atomics.pause), so the first
// openDatabaseSync in src/data/db/client.ts would fail. An async open loads the
// worker first; the app is required only after it.
//
// The database's files can be held by one page at a time. Closed and opened
// again at once, Telegram on an iPhone still has the old page for a moment,
// and the open fails ("The object is in an invalid state"). A failed open keeps
// some of the files itself, so it is not tried again on this page: the page
// reloads, a few times, a second apart.
const RELOADS = 'medkit.db-reloads';

SQLite.openDatabaseAsync('medkit.db')
  .then((db) => db.closeAsync())
  .then(() => {
    sessionStorage.removeItem(RELOADS);
    require('expo-router/entry');
  })
  .catch((error) => {
    const reloads = Number(sessionStorage.getItem(RELOADS) ?? 0);
    if (reloads >= 5) throw error;
    sessionStorage.setItem(RELOADS, String(reloads + 1));
    setTimeout(() => window.location.reload(), 1000);
  });
