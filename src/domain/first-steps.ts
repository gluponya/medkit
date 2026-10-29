/**
 * The «Перші кроки» card on an empty Home (docs/journeys.md J1, docs/screens.md
 * "First steps"). Add medicines, (only with intake) set up a reminder, and
 * last, whether to mark medicines with no proven effect. Nothing is required: a step is done, put off, or still open. A tap
 * on a put-off step takes it off the put-off list, which opens it again.
 */

export type StepId = 'medicines' | 'reminders' | 'evidence';
export type StepState = 'open' | 'done' | 'later';

export interface FirstStepsInput {
  /** The cabinet takes intake: only then is there a reminders step. */
  withIntake: boolean;
  medicineCount: number;
  reminderCount: number;
  /** «Позначати» or «Не треба» was picked (or the switch in Settings set). */
  evidenceAnswered: boolean;
  /** Steps the person put off with «Пізніше». */
  later: readonly StepId[];
}

export interface Step {
  id: StepId;
  state: StepState;
  /** The one step whose buttons are shown: the first open one. */
  current: boolean;
}

export function firstSteps(input: FirstStepsInput): Step[] {
  const ids: StepId[] = input.withIntake ? ['medicines', 'reminders', 'evidence'] : ['medicines', 'evidence'];
  const states = ids.map((id): StepState => {
    const done =
      id === 'medicines' ? input.medicineCount > 0 : id === 'reminders' ? input.reminderCount > 0 : input.evidenceAnswered;
    if (done) return 'done';
    return input.later.includes(id) ? 'later' : 'open';
  });
  const current = states.indexOf('open');
  return ids.map((id, i) => ({ id, state: states[i], current: i === current }));
}

/** The card is gone for good once nothing is left open. */
export function firstStepsFinished(steps: readonly Step[]): boolean {
  return steps.every((step) => step.state !== 'open');
}
