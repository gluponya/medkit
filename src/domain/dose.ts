/**
 * The reminder's «−» and «+»: a whole dose steps by one, and a dose typed as a
 * fraction («Змінити ліки» allows 0,5 or 2,5) goes to the next half first, so
 * 2,5 is 2 or 3 and 0,5 is never stepped down to nothing. The least is a half.
 */
export function stepDose(dose: number, delta: 1 | -1): number {
  const halves = dose * 2;
  const whole = Number.isInteger(dose);
  if (delta > 0) {
    if (whole) return dose + 1;
    // 2.5 → 3, 0.3 → 0.5
    return Number.isInteger(halves) ? Math.ceil(dose) : Math.ceil(halves) / 2;
  }
  if (whole) return dose > 1 ? dose - 1 : 0.5;
  const down = Number.isInteger(halves) ? Math.floor(dose) : Math.floor(halves) / 2;
  return Math.max(0.5, down);
}
