/** A person's role in a shared cabinet (docs/model.md, "Person and Membership"). */
export type MemberRole = 'owner' | 'admin' | 'member';

/** Edits medicines and packs, and invites: the owner and admins. */
export const canEdit = (role: MemberRole | null): boolean => role !== 'member';

/** Deletes the cabinet for everyone, changes roles, removes people: the owner, or anyone in a personal cabinet. */
export const isOwner = (role: MemberRole | null): boolean => role === null || role === 'owner';

/**
 * Invite codes: six of these, without 0/O and 1/I/L, which are misread when
 * said aloud or copied by hand. The server makes them with the same letters.
 */
export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** What was typed or pasted, as a code: upper case, only the code's letters, at most six. */
export function cleanCode(text: string): string {
  return [...text.toUpperCase()]
    .filter((c) => CODE_LETTERS.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

/** «K7Q 4MP»: the code in two halves, as it is shown and read aloud. */
export const showCode = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;

/** The code in a shared text or link: the first run of six code letters after «code» or «/j/». */
export function codeFromText(text: string): string | null {
  const m = text.toUpperCase().match(/(?:\/J\/|CODE[=:\s]*|КОД[:\s]*)([A-Z0-9]{3}\s?[A-Z0-9]{3})/);
  const raw = m ? m[1] : text.trim();
  const code = cleanCode(raw);
  return code.length === CODE_LENGTH ? code : null;
}
