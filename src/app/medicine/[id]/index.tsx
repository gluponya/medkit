import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import { useEvidenceNote } from '@/data/evidence';
import {
  changeStock,
  deleteMedicine,
  disposePack,
  disposeRemovesMedicine,
  takeDose,
  undoAdd,
  useMedicine,
  useMedicineCategories,
  usePacks,
  type Package,
} from '@/data/medicines';
import { getRegisterEntry } from '@/data/register';
import { useReminder, type Reminder } from '@/data/reminders';
import { buyNew, useInShopping } from '@/data/shopping';
import { useCabinetReminders, useDayIntakes } from '@/data/today';
import { daysBetween, expiryMonth, expiryStatus, localDay, unknownForYears } from '@/domain/expiry';
import { canEdit } from '@/domain/sharing';
import { stockOf } from '@/domain/stock';
import { doseToMark, todayDoses } from '@/domain/today';
import { FORM_ICON, FORM_NAME, UNIT } from '@/features/add/labels';
import { startPack } from '@/features/add/pack';
import { startPackChange, useChange } from '@/features/change/draft';
import { BodyTime } from '@/features/medicine/BodyTime';
import { useCategoryName } from '@/features/categories/categories';
import { shownStrength } from '@/features/medicine/strength';
import { hhmm, useNow } from '@/features/today/NextDoseCard';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon, type IconName } from '@/ui/Icon';
import { Group, Row } from '@/ui/Rows';
import { Confirm } from '@/ui/ConfirmSheet';
import { Sheet } from '@/ui/Sheet';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { Toast } from '@/ui/Toast';
import { type } from '@/ui/typography';

/**
 * Medicine (docs/screens.md, "Medicine"): what it is, its tags, how much is
 * left with «−» and «+», its packs worst-first with dispose and buy, the
 * reminder and the leaflet, and «Прийняти» in a cabinet that tracks intake.
 */
export default function MedicineScreen() {
  const t = useT();
  // added: the pack an add just made, for the «Додано» toast (docs/journeys.md, J2).
  // changed: «Змінити ліки» just ended here, for the «Ліки змінено» toast (J9).
  // moved: the cabinet it was just moved to, for «Перенесено в «…»».
  // packMoved: a pack of another medicine just came here, for «Упаковку перенесено».
  const { id, added, isNew, changed, moved, packMoved } = useLocalSearchParams<{
    id: string;
    added?: string;
    isNew?: string;
    changed?: string;
    moved?: string;
    packMoved?: string;
  }>();
  const [justAdded, setJustAdded] = useState(added ? { packageId: added, isNew: isNew === '1' } : null);
  // Opened by an add: until the screen is left, the footer offers what comes next, not «Прийняти».
  const [afterAdd, setAfterAdd] = useState(Boolean(added));
  const medicine = useMedicine(id);
  const packs = usePacks(id);
  const inShopping = useInShopping(id);
  const categories = useMedicineCategories(id) ?? [];
  const categoryName = useCategoryName();
  // One sheet at a time: «⋯», then the question it may lead to, in the same sheet.
  // A pack is «Утилізувати» of the last one; { pack } is that pack's «⋯».
  const [sheet, setSheet] = useState<'menu' | 'delete' | Package | { pack: Package } | null>(null);
  const reminder = useReminder(id) ?? undefined;
  const cabinet = useCabinets()?.find((c) => c.id === medicine?.cabinetId);
  const [open, setOpen] = useState(0);
  const [taken, setTaken] = useState(false);
  const taking = useRef(false);
  // «Прийняти» answers the dose Today would: the reminder's doses of today with their marks.
  const now = useNow();
  const plans = useCabinetReminders(medicine?.cabinetId);
  const marks = useDayIntakes(medicine?.cabinetId, localDay(now));
  const toMark = useMemo(
    () =>
      doseToMark(
        todayDoses((plans ?? []).filter((r) => r.medicineId === id), marks, localDay(now), hhmm(now)),
        hhmm(now),
      ),
    [plans, marks, id, now],
  );
  // The pack the last «−» used up: «+» can bring it back while the card stays.
  const [emptied, setEmptied] = useState<string | null>(null);
  const [leaflet, setLeaflet] = useState<string | null>(null);
  const [shelfLife, setShelfLife] = useState<number | null>(null);

  const registerId = medicine?.registerId ?? null;
  const evidence = useEvidenceNote(registerId);
  useEffect(() => {
    if (!registerId) return;
    let live = true;
    void getRegisterEntry(registerId).then((entry) => {
      if (!live) return;
      setLeaflet(entry?.instructionUrl ?? null);
      setShelfLife(entry?.shelfLifeMonths ?? null);
    });
    return () => {
      live = false;
    };
  }, [registerId]);

  useEffect(() => {
    if (!taken) return;
    const timer = setTimeout(() => setTaken(false), 1500);
    return () => clearTimeout(timer);
  }, [taken]);

  // Deleted from another screen, or still loading.
  if (!medicine) return null;

  const form = medicine.form ?? 'other';
  const unit = t(UNIT[form]);
  const stock = stockOf(packs);
  const counted = packs.filter((p) => p.quantity !== null).length;
  const withIntake = cabinet?.mode === 'with_intake';
  // A member of a shared cabinet counts, takes and disposes; the rest is the admins'.
  const edits = canEdit(cabinet?.role ?? null);
  const dose = toMark?.dose ?? reminder?.times[0]?.dose ?? 1;
  const today = localDay(now);
  const details = [medicine.inn, t(FORM_NAME[form]).toLocaleLowerCase(), shownStrength(medicine.strength)].filter(Boolean).join(', ');
  const subtitle = details.charAt(0).toLocaleUpperCase() + details.slice(1);

  const openCategories = () =>
    router.push({ pathname: '/medicine/[id]/categories', params: { id: medicine.id, from: 'chip' } });

  // «⋯»: the sheet closes first, then the screen it picked opens.
  const fromMenu = (go: () => void) => () => {
    setSheet(null);
    go();
  };

  const reminderText = (r: Reminder | undefined) => {
    if (!r) return t('medicine.noReminder');
    if (r.schedule === 'as_needed') return t('reminder.asNeeded');
    if (r.schedule === 'days_of_week') {
      return (r.daysOfWeek ?? []).map((d) => t(`weekday.${d}` as 'weekday.1')).join(', ');
    }
    return t('reminder.timesADay', { count: r.times.length });
  };

  // A pack without a date says how long it has been here instead of whole or opened.
  const addedAgo = (p: Package) => {
    if (p.expires !== null) return null;
    const years = unknownForYears(p.createdAt.slice(0, 10), today, shelfLife);
    return years === null ? null : t('expiry.addedYearsAgo', { count: years });
  };

  const packState = (p: Package) => {
    if (p.quantity === null) return addedAgo(p);
    return addedAgo(p) ?? (p.openedAt ? t('medicine.opened') : t('medicine.whole'));
  };

  const packLine = (p: Package, first: boolean) =>
    [
      p.quantity === null ? t('medicine.notCounted') : t('medicine.amount', { count: p.quantity, unit }),
      packState(p),
      first && packs.length > 1 ? t('medicine.takeFirst') : null,
    ]
      .filter(Boolean)
      .join(', ');

  const until = (p: Package) => {
    if (p.expires === null) return t('expiry.unknown');
    const { year, month } = expiryMonth(p.expires);
    return t('home.until', { date: `${String(month).padStart(2, '0')}.${year}` });
  };

  const badge = (expires: string | null) => {
    if (expires === null) return null;
    const status = expiryStatus(expires, today, cabinet?.expiryWarningDays ?? 30);
    if (status === 'good') return null;
    const tone = status === 'expired' ? colors.danger : colors.warning;
    const soft = status === 'expired' ? colors.dangerSoft : colors.warningSoft;
    return (
      <View style={[styles.badge, { backgroundColor: soft }]}>
        <View style={[styles.badgeDot, { backgroundColor: tone }]} />
        <Text style={[type.secondaryStrong, { color: tone }]}>
          {status === 'expired' ? t('home.expired') : t('medicine.daysLeft', { count: daysBetween(today, expires) })}
        </Text>
      </View>
    );
  };

  const undo = async () => {
    if (!justAdded) return;
    setJustAdded(null);
    setAfterAdd(false);
    await undoAdd({ medicineId: medicine.id, ...justAdded });
    if (justAdded.isNew) router.back();
  };

  // Back to the cabinet first: once the medicine is gone this screen has nothing to show.
  const leave = async (gone: () => Promise<void>) => {
    router.back();
    await gone();
  };

  // The last pack takes the medicine out of the cabinet, so only that one asks first.
  const dispose = async (p: Package) => {
    if (!(await disposeRemovesMedicine(medicine.id, p.id))) return disposePack(medicine.id, p.id);
    setSheet(p);
  };

  const change = () => {
    useChange.getState().reset();
    useChange.getState().set({ medicineId: medicine.id });
    router.push({ pathname: '/add/search', params: { change: medicine.id, q: medicine.name } });
  };

  // The dose due now (or within the hour, or the last one missed) is marked as
  // on Today; with none open the intake is one without a reminder.
  const take = async () => {
    if (taking.current) return;
    taking.current = true;
    try {
      await takeDose(
        toMark
          ? { medicineId: medicine.id, dose, reminderId: toMark.reminder.id, due: toMark.due }
          : { medicineId: medicine.id, dose },
      );
      setTaken(true);
    } finally {
      taking.current = false;
    }
  };

  // A «−» that empties the last counted pack keeps the card, so «+» can undo it.
  const less = async () => {
    const used = await changeStock(medicine.id, -1);
    if (used) setEmptied(used);
  };
  const more = async () => {
    await changeStock(medicine.id, 1, emptied);
    setEmptied(null);
  };

  // The card does not clip (it would lose its shadow), so the tint rounds its own outer corners.
  const newPackStyle = (i: number) => [
    styles.packNew,
    i === 0 && styles.packNewFirst,
    i === packs.length - 1 && styles.packNewLast,
  ];

  const newBadge = (
    <View style={styles.newBadge}>
      <Text style={[type.caption, styles.white]}>{t('medicine.newPack')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar
        label={cabinet?.name ?? t('common.back')}
        right={
          edits ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.more')}
              onPress={() => setSheet('menu')}
              hitSlop={8}
            >
              <Icon name="dots" size={26} color={colors.ink} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={styles.mark}>
            <Icon name={FORM_ICON[form]} size={30} color={colors.primary} />
          </View>
          <View style={styles.fill}>
            <FitTitle>{medicine.name}</FitTitle>
            {subtitle ? <Text style={type.label}>{subtitle}</Text> : null}
          </View>
        </View>

        {medicine.rx || categories.length > 0 || evidence ? (
          <View style={styles.chips}>
            {medicine.rx ? (
              <Pressable
                accessibilityRole="button"
                disabled={!edits}
                onPress={() => router.push({ pathname: '/medicine/[id]/details', params: { id: medicine.id, focus: 'rx' } })}
                style={[styles.chip, styles.chipRx]}
              >
                <Icon name="prescription" size={18} color={colors.warning} />
                <Text style={type.secondaryStrong}>{t('medicine.rx')}</Text>
              </Pressable>
            ) : null}
            {categories.map((c) => (
              <Pressable key={c} accessibilityRole="button" disabled={!edits} onPress={openCategories} style={[styles.chip, styles.chipTag]}>
                <Text style={[type.secondaryStrong, styles.primary]}>{categoryName(c)}</Text>
              </Pressable>
            ))}
            {evidence ? (
              <Pressable
                accessibilityRole="link"
                accessibilityHint={evidence.sourceName}
                onPress={() => void Linking.openURL(evidence.source)}
                style={[styles.chip, styles.chipEvidence]}
              >
                <Icon name="microscope" size={18} />
                <Text style={[type.secondaryStrong, styles.muted]}>{t('medicine.noEvidence')}</Text>
                <Icon name="external-link" size={16} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {stock !== null || emptied !== null ? (
          <View style={[styles.card, styles.stockCard]}>
            <View style={styles.stockRow}>
              <View style={styles.fill}>
                <Text style={type.label}>{t('medicine.left')}</Text>
                <View style={styles.amount}>
                  <Text style={styles.big}>{stock ?? 0}</Text>
                  <Text style={[type.bodyMedium, styles.amountUnit]}>{counted > 0 ? t('medicine.inPacks', { count: counted, unit }) : unit}</Text>
                </View>
              </View>
              <SquareButton icon="minus" label={t('medicine.less')} onPress={() => void less()} />
              <SquareButton icon="plus" label={t('medicine.more')} onPress={() => void more()} />
            </View>
            {medicine.lowStockThreshold !== null || medicine.rx ? (
              <View style={styles.stockNote}>
                <Icon name="bell" size={18} />
                <Text style={[type.label, styles.fill]}>
                  {[
                    medicine.lowStockThreshold !== null
                      ? t('medicine.buyAt', { count: medicine.lowStockThreshold, unit })
                      : null,
                    medicine.rx ? t('medicine.needRx') : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.titleRow}>
          <Text style={type.sectionTitle}>{t('medicine.packs')}</Text>
          {edits ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => startPack(medicine.id, medicine.form)}
              style={styles.add}
              hitSlop={8}
            >
              <Icon name="plus" size={20} color={colors.primary} />
              <Text style={[type.cardTitle, styles.primary]}>{t('medicine.addPack')}</Text>
            </Pressable>
          ) : null}
        </View>
        {packs.length > 0 ? (
          <View style={styles.card}>
            {packs.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                {i === open ? (
                  <View style={[styles.pack, p.id === justAdded?.packageId && newPackStyle(i)]}>
                    <View style={styles.packHead}>
                      <View style={[styles.packTitle, styles.fill]}>
                        <Text style={styles.packDate}>{until(p)}</Text>
                        {badge(p.expires)}
                        {p.id === justAdded?.packageId ? newBadge : null}
                      </View>
                      {/* With one pack, «Змінити ліки» in the top «⋯» is the same thing. */}
                      {edits && packs.length > 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('common.more')}
                          onPress={() => setSheet({ pack: p })}
                          hitSlop={12}
                        >
                          <Icon name="dots" size={24} color={colors.ink} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={type.label}>{packLine(p, i === 0)}</Text>
                    {p.expires === null && edits ? (
                      <View style={styles.packSet}>
                        <Button
                          label={t('expiry.set')}
                          icon="calendar-check"
                          variant="secondary"
                          height={44}
                          onPress={() => router.push({ pathname: '/medicine/[id]/expiry', params: { id, pack: p.id } })}
                        />
                      </View>
                    ) : null}
                    <View style={styles.packButtons}>
                      <View style={styles.fill}>
                        <Button label={t('medicine.dispose')} icon="trash" variant="outline" height={44} onPress={() => void dispose(p)} />
                      </View>
                      <View style={styles.fill}>
                        <Button
                          label={inShopping ? t('medicine.inShopping') : t('medicine.buyNew')}
                          icon={inShopping ? 'check' : 'shopping-cart-plus'}
                          variant="secondary"
                          height={44}
                          disabled={inShopping}
                          onPress={() => void buyNew(medicine)}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setOpen(i)} style={[styles.pack, styles.packClosed, p.id === justAdded?.packageId && newPackStyle(i)]}
                  >
                    <View style={styles.fill}>
                      <View style={styles.packTitle}>
                        <Text style={styles.packDate}>{until(p)}</Text>
                        {badge(p.expires)}
                        {p.id === justAdded?.packageId ? newBadge : null}
                      </View>
                      <Text style={type.label}>{packLine(p, i === 0)}</Text>
                    </View>
                    <Icon name="chevron-right" size={20} />
                  </Pressable>
                )}
              </Fragment>
            ))}
          </View>
        ) : null}

        {withIntake || leaflet ? (
          <View style={[styles.card, styles.links]}>
            {withIntake ? (
              <LinkRow
                icon="alarm"
                label={t('medicine.reminders')}
                value={reminderText(reminder)}
                onPress={() => router.push({ pathname: '/medicine/[id]/reminder', params: { id: medicine.id } })}
              />
            ) : null}
            {withIntake && leaflet ? <View style={styles.divider} /> : null}
            {leaflet ? (
              <LinkRow
                icon="file-text"
                label={t('medicine.instruction')}
                value={t('medicine.register')}
                onPress={() => router.push({ pathname: '/leaflet', params: { url: leaflet, back: medicine.name } })}
              />
            ) : null}
          </View>
        ) : null}

        <BodyTime medicineId={medicine.id} registerId={registerId} />
      </ScrollView>

      <View style={styles.bottom}>
        {justAdded ? (
          <Toast
            text={justAdded.isNew ? t('medicine.addedMedicine') : t('medicine.addedPack')}
            action={t('common.cancel')}
            onAction={() => void undo()}
            onHide={() => setJustAdded(null)}
            bottom={spacing.md}
          />
        ) : changed ? (
          <Toast
            text={t('change.done')}
            onHide={() => router.setParams({ changed: undefined })}
            bottom={spacing.md}
          />
        ) : packMoved ? (
          <Toast
            text={t('change.packDone')}
            onHide={() => router.setParams({ packMoved: undefined })}
            bottom={spacing.md}
          />
        ) : moved ? (
          <Toast
            text={t('move.done', { cabinet: moved })}
            onHide={() => router.setParams({ moved: undefined })}
            bottom={spacing.md}
          />
        ) : null}
      </View>
      {afterAdd ? (
        <View style={[styles.footer, styles.footerRow]}>
          <View style={styles.fill}>
            <Button
              label={t('medicine.addMore')}
              icon="plus"
              variant="secondary"
              onPress={() => router.push('/add/scan')}
            />
          </View>
          <View style={styles.fill}>
            <Button label={t('common.done')} icon="check" onPress={() => router.dismissTo('/home')} />
          </View>
        </View>
      ) : withIntake ? (
        <View style={styles.footer}>
          <Button
            label={taken ? t('medicine.taken') : t('medicine.take', { count: dose, unit })}
            icon="check"
            onPress={() => void take()}
            disabled={taken}
          />
        </View>
      ) : null}
      {sheet ? (
        <Sheet onClose={() => setSheet(null)}>
          {sheet === 'delete' ? (
            <Confirm
              title={t('medicine.deleteTitle', { name: medicine.name })}
              text={packs.length > 0 ? t('medicine.deleteText', { count: packs.length }) : t('medicine.deleteTextNoPacks')}
              confirm={t('medicine.delete')}
              onConfirm={() => void leave(() => deleteMedicine(medicine.id))}
              onClose={() => setSheet(null)}
            />
          ) : sheet !== 'menu' && 'pack' in sheet ? (
            <>
              <Text style={type.sectionTitle}>
                {sheet.pack.expires === null ? t('change.packUnknown') : t('change.packOf', { until: until(sheet.pack) })}
              </Text>
              <Text style={type.label}>
                {sheet.pack.quantity === null
                  ? medicine.name
                  : `${medicine.name}, ${t('medicine.amount', { count: sheet.pack.quantity, unit })}`}
              </Text>
              <Group>
                <Row
                  icon="arrows-split"
                  label={t('change.packOther')}
                  hint={t('change.packOtherText')}
                  onPress={fromMenu(() => startPackChange(medicine.id, sheet.pack.id, medicine.name))}
                />
              </Group>
            </>
          ) : sheet !== 'menu' ? (
            <Confirm
              title={t('medicine.disposeLastTitle')}
              text={t('medicine.disposeLastText', { name: medicine.name })}
              confirm={t('medicine.dispose')}
              onConfirm={() => void leave(() => disposePack(medicine.id, sheet.id))}
              onClose={() => setSheet(null)}
            />
          ) : (
            <Group>
              <Row
                icon="pencil"
                label={t('details.title')}
                onPress={fromMenu(() => router.push({ pathname: '/medicine/[id]/details', params: { id: medicine.id } }))}
              />
              <Row icon="arrows-exchange" label={t('medicine.change')} onPress={fromMenu(change)} />
              <Row icon="trash" label={t('medicine.delete')} onPress={() => setSheet('delete')} />
            </Group>
          )}
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

function SquareButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.square, pressed && styles.pressed]}
    >
      <Icon name={icon} size={24} color={colors.primary} />
    </Pressable>
  );
}

function LinkRow({
  icon,
  label,
  value,
  external = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  external?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkRow}>
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={[type.cardTitle, styles.fill]}>{label}</Text>
      <Text style={type.label}>{value}</Text>
      <Icon name={external ? 'external-link' : 'chevron-right'} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  primary: { color: colors.primary },
  muted: { color: colors.inkMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  chip: {
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chipRx: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipTag: { backgroundColor: colors.primarySoft },
  chipEvidence: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.line },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  stockCard: { marginTop: spacing.lg, padding: spacing.lg },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Bottom-aligned, not on the baseline: Android does not re-measure baseline text when it changes.
  amount: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  amountUnit: { color: colors.inkMuted, marginBottom: 6, flexShrink: 1 },
  big: { ...type.hero, fontSize: 34, lineHeight: 42 },
  square: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  stockNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  titleRow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: spacing.lg },
  pack: { padding: spacing.lg, gap: spacing.xs },
  packClosed: { flexDirection: 'row', alignItems: 'center' },
  packNew: { backgroundColor: colors.primarySoft },
  packNewFirst: { borderTopLeftRadius: radius.card - 1, borderTopRightRadius: radius.card - 1 },
  packNewLast: { borderBottomLeftRadius: radius.card - 1, borderBottomRightRadius: radius.card - 1 },
  newBadge: {
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  white: { color: colors.white },
  bottom: { zIndex: 10 },
  packHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  packDate: { ...type.sectionTitle, fontSize: 18 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  packSet: { marginTop: spacing.sm },
  packButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  links: { marginTop: spacing.xxl },
  linkRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
