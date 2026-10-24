import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import {
  changeStock,
  disposePack,
  takeDose,
  useMedicine,
  useMedicineCategories,
  usePacks,
  type Package,
} from '@/data/medicines';
import { getRegisterEntry } from '@/data/register';
import { useReminder, type Reminder } from '@/data/reminders';
import { CATEGORIES, type Category } from '@/domain/categories';
import { daysBetween, expiryMonth, expiryStatus, localDay } from '@/domain/expiry';
import { stockOf } from '@/domain/stock';
import { CATEGORY_NAME, FORM_ICON, FORM_NAME, UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const soon = () => router.push('/soon');

/**
 * Medicine (docs/screens.md, "Medicine"): what it is, its tags, how much is
 * left with «−» and «+», its packs worst-first with dispose and buy, the
 * reminder and the leaflet, and «Прийняти» in a cabinet that tracks intake.
 */
export default function MedicineScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicine = useMedicine(id);
  const packs = usePacks(id);
  const categories = useMedicineCategories(id);
  const reminder = useReminder(id) ?? undefined;
  const cabinet = useCabinets()?.find((c) => c.id === medicine?.cabinetId);
  const [open, setOpen] = useState(0);
  const [taken, setTaken] = useState(false);
  const [leaflet, setLeaflet] = useState<string | null>(null);

  const registerId = medicine?.registerId ?? null;
  useEffect(() => {
    if (!registerId) return;
    let live = true;
    void getRegisterEntry(registerId).then((entry) => {
      if (live) setLeaflet(entry?.instructionUrl ?? null);
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
  const dose = reminder?.times[0]?.dose ?? 1;
  const today = localDay(new Date());
  const details = [medicine.inn, t(FORM_NAME[form]).toLocaleLowerCase(), medicine.strength].filter(Boolean).join(', ');
  const subtitle = details.charAt(0).toLocaleUpperCase() + details.slice(1);

  const categoryName = (key: string) =>
    (CATEGORIES as readonly string[]).includes(key) ? t(CATEGORY_NAME[key as Category]) : key;

  const reminderText = (r: Reminder | undefined) => {
    if (!r) return t('medicine.noReminder');
    if (r.schedule === 'as_needed') return t('reminder.asNeeded');
    if (r.schedule === 'days_of_week') {
      return (r.daysOfWeek ?? []).map((d) => t(`weekday.${d}` as 'weekday.1')).join(', ');
    }
    return t('reminder.timesADay', { count: r.times.length });
  };

  const packLine = (p: Package, first: boolean) =>
    [
      p.quantity === null ? t('medicine.notCounted') : t('medicine.amount', { count: p.quantity, unit }),
      p.quantity === null ? null : p.openedAt ? t('medicine.opened') : t('medicine.whole'),
      first && packs.length > 1 ? t('medicine.takeFirst') : null,
    ]
      .filter(Boolean)
      .join(', ');

  const until = (expires: string) => {
    const { year, month } = expiryMonth(expires);
    return t('home.until', { date: `${String(month).padStart(2, '0')}.${year}` });
  };

  const badge = (expires: string) => {
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

  const take = async () => {
    await takeDose({ medicineId: medicine.id, dose, reminderId: reminder?.id ?? null });
    setTaken(true);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar
        label={cabinet?.name ?? t('common.back')}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.more')} onPress={soon} hitSlop={8}>
            <Icon name="dots" size={26} color={colors.ink} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={styles.mark}>
            <Icon name={FORM_ICON[form]} size={30} color={colors.primary} />
          </View>
          <View style={styles.fill}>
            <Text style={type.screenTitle}>{medicine.name}</Text>
            {subtitle ? <Text style={type.label}>{subtitle}</Text> : null}
          </View>
        </View>

        {medicine.rx || categories.length > 0 ? (
          <View style={styles.chips}>
            {medicine.rx ? (
              <View style={[styles.chip, styles.chipRx]}>
                <Icon name="prescription" size={18} color={colors.warning} />
                <Text style={type.secondaryStrong}>{t('medicine.rx')}</Text>
              </View>
            ) : null}
            {categories.map((c) => (
              <Pressable key={c} accessibilityRole="button" onPress={soon} style={[styles.chip, styles.chipTag]}>
                <Text style={[type.secondaryStrong, styles.primary]}>{categoryName(c)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {stock !== null ? (
          <View style={[styles.card, styles.stockCard]}>
            <View style={styles.stockRow}>
              <View style={styles.fill}>
                <Text style={type.label}>{t('medicine.left')}</Text>
                <View style={styles.amount}>
                  <Text style={styles.big}>{stock}</Text>
                  <Text style={[type.bodyMedium, styles.amountUnit]}>{t('medicine.inPacks', { count: counted, unit })}</Text>
                </View>
              </View>
              <SquareButton icon="minus" label={t('medicine.less')} onPress={() => void changeStock(medicine.id, -1)} />
              <SquareButton icon="plus" label={t('medicine.more')} onPress={() => void changeStock(medicine.id, 1)} />
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
          <Pressable accessibilityRole="button" onPress={soon} style={styles.add} hitSlop={8}>
            <Icon name="plus" size={20} color={colors.primary} />
            <Text style={[type.cardTitle, styles.primary]}>{t('medicine.addPack')}</Text>
          </Pressable>
        </View>
        {packs.length > 0 ? (
          <View style={styles.card}>
            {packs.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                {i === open ? (
                  <View style={styles.pack}>
                    <View style={styles.packTitle}>
                      <Text style={styles.packDate}>{until(p.expires)}</Text>
                      {badge(p.expires)}
                    </View>
                    <Text style={type.label}>{packLine(p, i === 0)}</Text>
                    <View style={styles.packButtons}>
                      <View style={styles.fill}>
                        <Button label={t('medicine.dispose')} icon="trash" variant="outline" height={44} onPress={() => void disposePack(p.id)} />
                      </View>
                      <View style={styles.fill}>
                        <Button label={t('medicine.buyNew')} icon="shopping-cart-plus" variant="secondary" height={44} onPress={soon} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setOpen(i)} style={[styles.pack, styles.packClosed]}>
                    <View style={styles.fill}>
                      <View style={styles.packTitle}>
                        <Text style={styles.packDate}>{until(p.expires)}</Text>
                        {badge(p.expires)}
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
                external
                onPress={() => void Linking.openURL(leaflet)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {withIntake ? (
        <View style={styles.footer}>
          <Button
            label={taken ? t('medicine.taken') : t('medicine.take', { count: dose, unit })}
            icon="check"
            onPress={() => void take()}
            disabled={taken}
          />
        </View>
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
  packButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  links: { marginTop: spacing.xxl },
  linkRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
