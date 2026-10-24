import { pluralCategory } from './plural.ts';
import type { Language, Message, MessageParams } from './types.ts';

/**
 * Turning a catalogue entry into text: the plural form, then the placeholders.
 * Pure and apart from `index.ts`, so a future push from the server can word its
 * text by the same rules.
 */
export function formatMessage(message: Message, language: Language, params?: MessageParams): string {
  return interpolate(pick(message, language, params), params);
}

function pick(message: Message, language: Language, params?: MessageParams): string {
  if (typeof message === 'string') return message;

  const count = params?.count;
  if (typeof count !== 'number') return message.other;

  return message[pluralCategory(language, count)] ?? message.other;
}

function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text;
  // An unknown placeholder is left as it is rather than blanked: seeing {name}
  // in the interface points straight at the bug, an empty gap does not.
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
