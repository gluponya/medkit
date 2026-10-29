import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMedicine, usePacks, type Medicine } from '@/data/medicines';
import { askForNotifications } from '@/data/notifications';
import { deleteReminders, saveReminder, useReminder, type Reminder } from '@/data/reminders';
import { localDay } from '@/domain/expiry';
import {
  COURSE_DAYS,
  courseEnd,
  daysOfSupply,
  PRESET_TIMES,
  startOf,
  unitsNeeded,
  type ReminderPlan,
} from '@/domain/reminders';
import { stockOf } from '@/domain/stock';
import { FORM_NAME, UNIT } from '@/features/add/labels';
import { shownStrength } from '@/features/medicine/strength';
import { useI18n, useT } from '@/i18n';
import { accusativeUk } from '@/i18n/grammar';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Pick = 1 | 2 | 3 | 'other';

/** The wheel steps by five minutes, as doses are set. */
const MINUTE_STEP = 5;
const WEEK = [1, 2, 3, 4, 5, 6, 7];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * New reminder (docs/screens.md, "New reminder"): how often, then the times,
 * the dose and how long, and what the course needs against what is left.
 * A medicine has one plan; saving replaces the one it had.
 */
export default function ReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicine = useMedicine(id);
  const saved = useReminder(id);
  // The form starts from the saved plan, so it waits for it.
  if (!medicine || saved === undefined) return null;
  return <ReminderForm medicine={medicine} saved={saved} />;
}

/** The saved plan's card: a daily one with up to three times is a preset. */
function pickOf(saved: Reminder): Pick {
  const n = saved.times.length;
  return saved.schedule === 'daily' && n >= 1 && n <= 3 ? (n as 1 | 2 | 3) : 'other';
}

function ReminderForm({ medicine, saved }: { medicine: Medicine; saved: Reminder | null }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const stock = stockOf(usePacks(medicine.id));

  const [pick, setPick] = useState<Pick | null>(saved ? pickOf(saved) : null);
  const [asNeeded, setAsNeeded] = useState(saved?.schedule === 'as_needed');
  const [weekdays, setWeekdays] = useState<number[]>(saved?.daysOfWeek ?? []);
  const [times, setTimes] = useState<string[]>(
    saved && saved.schedule !== 'as_needed' ? saved.times.map((d) => d.time) : [],
  );
  const [dose, setDose] = useState(saved?.times[0]?.dose ?? 1);
  const [days, setDays] = useState<number | null>(saved?.days ?? null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [askDays, setAskDays] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = localDay(new Date());
  const plan = useMemo<ReminderPlan | null>(() => {
    if (pick === null) return null;
    if (pick === 'other' && asNeeded) {
      // No times: the dose is kept so «Прийняти» knows how much.
      return { schedule: 'as_needed', times: [{ time: '', dose }], daysOfWeek: null, start: today, days: null };
    }
    if (times.length === 0) return null;
    const doseTimes = [...times].sort().map((time) => ({ time, dose }));
    if (pick === 'other') {
      if (weekdays.length === 0) return null;
      return { schedule: 'days_of_week', times: doseTimes, daysOfWeek: [...weekdays].sort(), start: startOf(saved, { schedule: 'days_of_week', days }, today), days };
    }
    return { schedule: 'daily', times: doseTimes, daysOfWeek: null, start: startOf(saved, { schedule: 'daily', days }, today), days };
  }, [pick, asNeeded, times, dose, weekdays, days, today, saved]);

  const form = medicine.form ?? 'other';
  const unit = t(UNIT[form]);
  const subtitle = [t(FORM_NAME[form]), shownStrength(medicine.strength)].filter(Boolean).join(', ');
  const name = language === 'uk' ? accusativeUk(medicine.name) : medicine.name;

  const choose = (p: Pick) => {
    setPick(p);
    if (p !== 'other') setTimes([...PRESET_TIMES[p]]);
    else if (times.length === 0) setTimes([...PRESET_TIMES[1]]);
  };

  const setTime = (time: string) => {
    if (editing === 'new') setTimes((list) => (list.includes(time) ? list : [...list, time].sort()));
    else if (editing !== null) setTimes((list) => [...new Set(list.map((x, i) => (i === editing ? time : x)))].sort());
    setEditing(null);
  };

  const save = async () => {
    if (!plan) return;
    setBusy(true);
    await askForNotifications();
    await saveReminder(medicine.id, plan);
    router.back();
  };

  const turnOff = async () => {
    setBusy(true);
    await deleteReminders(medicine.id);
    router.back();
  };

  const end = plan ? courseEnd(plan) : null;
  const endText = (day: string) => {
    const [, month, date] = day.split('-').map(Number);
    return t('reminder.untilDay', {
      day: date,
      month: t(`month.until.${month}` as 'month.until.1', { year: '' }).trim(),
    });
  };
  const need = plan ? unitsNeeded(plan) : null;
  const lasts = plan ? daysOfSupply(plan, stock) : null;
  const showSummary = plan !== null && plan.schedule !== 'as_needed';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={medicine.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <FitTitle>{t('reminder.title', { name })}</FitTitle>
        {subtitle ? <Text style={[type.label, styles.subtitle]}>{subtitle}</Text> : null}

        <View style={styles.grid}>
          {([1, 2, 3] as const).map((n) => (
            <Card
              key={n}
              title={t('reminder.timesADay', { count: n })}
              text={(pick === n ? [...times].sort() : PRESET_TIMES[n]).join(', ')}
              picked={pick === n}
              onPress={() => choose(n)}
            />
          ))}
          <Card
            title={t('reminder.other')}
            text={t('reminder.otherHint')}
            picked={pick === 'other'}
            onPress={() => choose('other')}
          />
        </View>

        {pick === 'other' ? (
          <>
            {/* Which kind first, so a weekday and «За потреби» are never in one row. */}
            <View style={styles.chips}>
              <Chip label={t('reminder.onDays')} big picked={!asNeeded} onPress={() => setAsNeeded(false)} />
              <Chip label={t('reminder.asNeeded')} big picked={asNeeded} onPress={() => setAsNeeded(true)} />
            </View>
            {!asNeeded ? (
              <View style={styles.week}>
                {WEEK.map((d) => (
                  <Chip
                    key={d}
                    label={t(`weekday.${d}` as 'weekday.1')}
                    round
                    picked={weekdays.includes(d)}
                    onPress={() => setWeekdays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {pick !== null ? (
          <>
            {!(pick === 'other' && asNeeded) ? (
              <View style={styles.row}>
                <Text style={[type.bodyMedium, styles.rowLabel]}>{t('reminder.time')}</Text>
                <View style={styles.rowEnd}>
                  {times.map((time, i) => (
                    <Chip key={time} label={time} big accent onPress={() => setEditing(i)} />
                  ))}
                  <Round icon="plus" label={t('reminder.addTime')} onPress={() => setEditing('new')} />
                </View>
              </View>
            ) : null}

            <View style={styles.row}>
              <Text style={[type.bodyMedium, styles.rowLabel]}>{t('reminder.perDose')}</Text>
              <View style={styles.rowEnd}>
                <Round icon="minus" label={t('medicine.less')} onPress={() => setDose((d) => Math.max(1, d - 1))} />
                <Text style={[type.sectionTitle, styles.dose]}>{t('medicine.amount', { count: dose, unit })}</Text>
                <Round icon="plus" label={t('medicine.more')} onPress={() => setDose((d) => d + 1)} />
              </View>
            </View>

            {!(pick === 'other' && asNeeded) ? (
              <>
                <Text style={[type.bodyMedium, styles.daysLabel]}>{t('reminder.days')}</Text>
                <View style={styles.chips}>
                  <Chip label={t('reminder.ongoing')} big picked={days === null} onPress={() => setDays(null)} />
                  {COURSE_DAYS.map((n) => (
                    <Chip key={n} label={String(n)} big picked={days === n} onPress={() => setDays(n)} />
                  ))}
                  <Chip
                    label={
                      days !== null && !(COURSE_DAYS as readonly number[]).includes(days)
                        ? t('reminder.daysCount', { count: days })
                        : t('reminder.otherDays')
                    }
                    big
                    picked={days !== null && !(COURSE_DAYS as readonly number[]).includes(days)}
                    onPress={() => setAskDays(true)}
                  />
                </View>
              </>
            ) : null}

            {plan?.schedule === 'as_needed' ? (
              <View style={styles.summary}>
                <Text style={type.cardTitle}>{t('reminder.noAlerts')}</Text>
                <Text style={type.label}>{t('reminder.noAlertsText')}</Text>
              </View>
            ) : null}

            {showSummary ? (
              <View style={styles.summary}>
                <Text style={type.cardTitle}>{end ? endText(end) : t('reminder.fromToday')}</Text>
                {need !== null && stock !== null ? (
                  <Text style={type.label}>{t('reminder.need', { need, unit, have: stock })}</Text>
                ) : lasts !== null ? (
                  <Text style={type.label}>{t('reminder.enough', { count: lasts })}</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {saved ? (
          <View style={styles.turnOff}>
            <Button label={t('reminder.turnOff')} variant="outline" onPress={() => void turnOff()} disabled={busy} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('common.save')} onPress={() => void save()} disabled={!plan || busy} />
      </View>

      {editing !== null ? (
        <TimeSheet
          start={typeof editing === 'number' ? times[editing] : '08:00'}
          canRemove={typeof editing === 'number' && times.length > 1}
          onPick={setTime}
          onRemove={() => {
            if (typeof editing === 'number') setTimes((list) => list.filter((_, i) => i !== editing));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {askDays ? (
        <DaysSheet
          onDone={(n) => {
            if (n) setDays(n);
            setAskDays(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Card({ title, text, picked, onPress }: { title: string; text: string; picked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: picked }}
      onPress={onPress}
      style={[styles.card, picked && styles.cardPicked]}
    >
      <View style={styles.cardTitle}>
        <Text style={[type.sectionTitle, styles.fill, picked && styles.primary]}>{title}</Text>
        {picked ? (
          <View style={styles.check}>
            <Icon name="check" size={16} color={colors.white} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
      <Text style={[type.label, picked && styles.primary]}>{text}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  picked = false,
  big = false,
  round = false,
  accent = false,
  onPress,
}: {
  label: string;
  picked?: boolean;
  big?: boolean;
  /** A weekday: a circle, seven to a row. */
  round?: boolean;
  /** Blue text: a value to tap and change, like a time. */
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      onPress={onPress}
      style={[styles.chip, big && styles.chipBig, round && styles.chipRound, picked && styles.chipPicked]}
    >
      <Text style={[big || round ? type.sectionTitle : type.bodyMedium, (big || round) && styles.chipBigText, accent && styles.primary, picked && styles.white]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Round({ icon, label, onPress }: { icon: 'plus' | 'minus'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round}>
      <Icon name={icon} size={24} color={colors.primary} />
    </Pressable>
  );
}

/** A bottom sheet, mounted only while open so it starts from its props. */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Rides on the keyboard, or «Скільки днів» ends up under it. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TimeSheet({
  start,
  canRemove,
  onPick,
  onRemove,
  onClose,
}: {
  start: string;
  canRemove: boolean;
  onPick: (time: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const language = useI18n((state) => state.language);
  const [h, m] = start.split(':').map(Number);
  const [time, setTime] = useState(() => {
    const date = new Date();
    date.setHours(h, m - (m % MINUTE_STEP), 0, 0);
    return date;
  });
  const picked = `${pad(time.getHours())}:${pad(time.getMinutes())}`;
  // The system wheel, 24-hour in both languages.
  const locale = language === 'uk' ? 'uk-UA' : 'en-GB';

  // Android has no inline wheel: the system dialog stands in for the sheet.
  if (Platform.OS !== 'ios') {
    return (
      <DateTimePicker
        value={time}
        mode="time"
        is24Hour
        minuteInterval={MINUTE_STEP}
        onChange={(event, date) => {
          if (event.type === 'set' && date) onPick(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
          else onClose();
        }}
      />
    );
  }

  return (
    <Sheet onClose={onClose}>
      <Text style={type.sectionTitle}>{t('reminder.pickTime')}</Text>
      <DateTimePicker
        value={time}
        mode="time"
        display="spinner"
        locale={locale}
        minuteInterval={MINUTE_STEP}
        textColor={colors.ink}
        themeVariant="light"
        onChange={(_, date) => date && setTime(date)}
        style={styles.wheel}
      />
      <View style={styles.sheetButtons}>
        {canRemove ? (
          <View style={styles.fill}>
            <Button label={t('reminder.removeTime')} icon="trash" variant="outline" onPress={onRemove} />
          </View>
        ) : null}
        <View style={styles.fill}>
          <Button label={t('common.done')} onPress={() => onPick(picked)} />
        </View>
      </View>
    </Sheet>
  );
}

function DaysSheet({ onDone }: { onDone: (days: number | null) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const n = Number(text);
  const valid = Number.isInteger(n) && n >= 1 && n <= 365;
  return (
    <Sheet onClose={() => onDone(null)}>
      <Text style={type.sectionTitle}>{t('reminder.howManyDays')}</Text>
      <TextInput
        value={text}
        onChangeText={(v) => setText(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        autoFocus
        style={styles.input}
      />
      <Button label={t('common.done')} onPress={() => onDone(valid ? n : null)} disabled={!valid} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  subtitle: { marginTop: spacing.xs },
  fill: { flex: 1 },
  primary: { color: colors.primary },
  white: { color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  card: {
    width: '47.8%',
    flexGrow: 1,
    minHeight: 84,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  cardPicked: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBig: { height: 48, minWidth: 48, paddingHorizontal: spacing.md + 2 },
  chipBigText: { fontFamily: type.bodyMedium.fontFamily, fontSize: 17 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  chipRound: { width: 44, height: 44, minWidth: 0, paddingHorizontal: 0, borderRadius: 22 },
  chipPicked: { backgroundColor: colors.primary, borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  rowLabel: { fontSize: 17, flexShrink: 0 },
  rowEnd: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm },
  dose: { minWidth: 72, textAlign: 'center', fontSize: 17 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysLabel: { fontSize: 17, marginTop: spacing.xl },
  summary: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  turnOff: { marginTop: spacing.xxl },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(47,58,79,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    padding: spacing.lg,
    gap: spacing.md,
  },
  wheel: { alignSelf: 'stretch', height: 216 },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    ...type.input,
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 22,
  },
});
