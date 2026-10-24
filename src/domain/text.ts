const letter = /[\p{L}\p{N}]/u;

/**
 * True when a line of laid-out text ends inside a word: the text system broke
 * a word wider than the line («Атенолол-Астрафар / м»). A break at a space or
 * after a hyphen ends the line on that space or hyphen, so it does not count.
 */
export function breaksWord(lines: readonly { text: string }[]): boolean {
  for (let i = 0; i < lines.length - 1; i++) {
    const end = lines[i].text.at(-1) ?? '';
    const start = lines[i + 1].text[0] ?? '';
    if (letter.test(end) && letter.test(start)) return true;
  }
  return false;
}
