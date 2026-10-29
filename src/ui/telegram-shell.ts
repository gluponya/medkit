/**
 * The app opened as a Telegram mini app (docs/telegram.md).
 *
 * Telegram's own telegram-web-app.js is not loaded: the page is served with
 * COEP require-corp for SQLite's worker, and a script from telegram.org would
 * have to be self-hosted to pass it. What the app needs from Telegram is a few
 * messages, and the protocol for those is small enough to speak directly
 * (core.telegram.org/api/web-events). As Freshka's.
 */

import { colors } from './theme';

type Proxy = { postEvent(type: string, data: string): void };

// Telegram passes its launch parameters in the hash, and the router rewrites
// the address as it starts. A screen's code is loaded only when it is first
// opened, after that, so the parameters are kept for the session the moment
// they are first seen, and read back from there.
const KEPT = 'medkit.telegram-launch';

function readLaunch(): URLSearchParams {
  if (typeof window === 'undefined' || !window.location) return new URLSearchParams();
  const hash = window.location.hash.slice(1);
  try {
    if (hash.includes('tgWebApp')) sessionStorage.setItem(KEPT, hash);
    return new URLSearchParams(sessionStorage.getItem(KEPT) ?? hash);
  } catch {
    return new URLSearchParams(hash);
  }
}

const launch = readLaunch();

export function inTelegram(): boolean {
  return launch.has('tgWebAppData') || launch.has('tgWebAppVersion');
}

/**
 * Who opened the app, signed by the bot (`initData`), as the server checks it
 * (supabase/functions/telegram-signin); null outside Telegram.
 */
export function telegramInitData(): string | null {
  return launch.get('tgWebAppData');
}

function post(type: string, data: object = {}): void {
  const body = JSON.stringify(data);
  const proxy = (window as unknown as { TelegramWebviewProxy?: Proxy }).TelegramWebviewProxy;
  if (proxy) {
    // iOS and Android
    proxy.postEvent(type, body);
  } else if (window.parent !== window) {
    // Telegram Web and Desktop
    window.parent.postMessage(JSON.stringify({ eventType: type, eventData: data }), '*');
  }
}

export function setUpTelegramShell(): void {
  if (!inTelegram()) return;

  post('web_app_ready');
  post('web_app_expand');
  // A drag down in a list is otherwise Telegram closing the app.
  post('web_app_setup_swipe_behavior', { allow_vertical_swipe: false });
  // Telegram's header and the strip under the tabs in the app's own colours, not the chat theme's.
  post('web_app_set_header_color', { color: colors.bg });
  post('web_app_set_background_color', { color: colors.bg });
  post('web_app_set_bottom_bar_color', { color: colors.surface });
}
