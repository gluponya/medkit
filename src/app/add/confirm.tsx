import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { rememberCode } from '@/data/barcodes';
import { useCurrentCabinet } from '@/data/cabinets';
import { addMedicine, addPackage, sameMedicine, useKnownMedicines, usePackCount } from '@/data/medicines';
import { localDay } from '@/domain/expiry';
import { formWord, packSizes } from '@/domain/register';
import { ExpirySummary, UnknownExpirySummary } from '@/features/add/ExpiryPicker';
import { draftExpires, expiryAnswered, useDraft } from '@/features/add/draft';
import { finishAdd } from '@/features/add/finish';
import { FORM_ICON, FORM_NAME, UNIT } from '@/features/add/labels';
import { useScan } from '@/features/add/scan';
import { shownStrength } from '@/features/medicine/strength';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon, type IconName } from '@/ui/Icon';
import { Tile } from '@/ui/Tile';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';
import { useFieldInView } from '@/ui/useFieldInView';

/** Five digits is more than any pack holds, and keeps the number on one line. */
const MAX_QUANTITY = 99999;
/** Pack sizes offered as tiles; only a few Register entries list more. */
const MAX_SIZES = 4;

/**
 * Confirm medicine (docs/screens.md): what the Register says it is, the
 * expiry (required, asked for by the footer until set) and how much is in
 * the pack, offered from the pack sizes the Register lists. A medicine the cabinet
 * already has gets another pack instead of a second entry.
 */
export default function ConfirmScreen() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const draft = useDraft();
  const entry = draft.register;
  const known = useKnownMedicines(cabinet?.id);
  const existing = entry ? sameMedicine(known, entry.id, draft.name) : null;
  const packCount = usePackCount(existing?.id);
  const [saving, setSaving] = useState(false);
  const sizes = entry ? packSizes(entry.formText, entry.form).slice(0, MAX_SIZES) : [];
  const onlySize = sizes.length === 1 ? sizes[0] : null;

  // One size in the Register is the pack in hand: filled in, still editable.
  useEffect(() => {
    if (onlySize !== null && useDraft.getState().quantity === null) useDraft.getState().set({ quantity: onlySize });
  }, [entry?.id, onlySize]);

  const scroll = useRef<ScrollViewInstance>(null);
  const fieldInView = useFieldInView(scroll);

  // The draft was dropped under the screen (a finished add), nothing to show.
  if (!entry || !cabinet) return null;

  const form = entry.form;
  const { year, month } = draft;
  const ready = expiryAnswered(draft);
  // An empty field is «not counted»; a typed 0 is an empty pack, never added.
  const zero = draft.quantity === 0;
  const details = [
    entry.inn,
    form === 'other'
      ? (formWord(entry.formText) ?? t(FORM_NAME.other).toLocaleLowerCase())
      : t(FORM_NAME[form]).toLocaleLowerCase(),
    shownStrength(entry.strength),
  ]
    .filter(Boolean)
    .join(', ');

  const setQuantity = (quantity: number | null) =>
    draft.set({
      quantity: quantity === null ? null : Math.min(MAX_QUANTITY, Math.max(0, quantity)),
    });

  const save = async () => {
    const expires = draftExpires(draft);
    if (expires === undefined || zero) return;
    const quantity = draft.quantity;
    setSaving(true);
    try {
      const added = existing
        ? await addPackage({ medicineId: existing.id, expires, quantity })
        : await addMedicine({
            cabinetId: cabinet.id,
            name: draft.name,
            form,
            expires,
            quantity,
            categories: [],
            register: {
              id: entry.id,
              inn: entry.inn,
              strength: entry.strength,
              manufacturer: entry.manufacturer,
              rx: entry.rx,
            },
          });
      const { scan } = useScan.getState();
      if (scan) rememberCode(scan.gtin, entry.id, quantity !== null && sizes.includes(quantity) ? quantity : null);
      finishAdd(added);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('confirm.back')} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scroll}
          {...fieldInView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.head}>
            <View style={styles.mark}>
              <Icon name={FORM_ICON[form]} size={30} color={colors.primary} />
            </View>
            <View style={styles.fill}>
              <FitTitle>{draft.name}</FitTitle>
              {details ? <Text style={type.label}>{details}</Text> : null}
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.other}>
            <Icon name="arrows-exchange" size={20} color={colors.primary} />
            <Text style={[type.cardTitle, styles.primary]}>{t('confirm.other')}</Text>
          </Pressable>

          {existing ? (
            <View style={styles.has}>
              <Icon name="stack" size={22} />
              <Text style={[type.bodyMedium, styles.muted, styles.fill]}>
                {packCount > 0
                  ? t('confirm.has', {
                      count: packCount,
                      cabinet: cabinet.name,
                    })
                  : t('confirm.hasNoPacks', { cabinet: cabinet.name })}
              </Text>
            </View>
          ) : null}

          {ready ? (
            <View style={styles.expiry}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('confirm.changeExpiry')}
                onPress={() => router.push('/add/when')}
              >
                {year !== null && month !== null ? (
                  <ExpirySummary year={year} month={month} today={localDay(new Date())} />
                ) : (
                  <UnknownExpirySummary />
                )}
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.card, styles.quantity, zero && styles.quantityWrong]}>
            <View style={styles.fill}>
              <Text style={type.label}>{t('confirm.inPack')}</Text>
              <View style={styles.amount}>
                {/* iOS does not resize a text field when its value is set by the buttons, so the second
                  digit got clipped: a hidden copy of the number sizes the box, the field covers it. */}
                <View>
                  <Text style={[styles.big, styles.sizer]}>
                    {draft.quantity === null ? '0' : String(draft.quantity)}
                  </Text>
                  <TextInput
                    value={draft.quantity === null ? '' : String(draft.quantity)}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '');
                      setQuantity(digits ? Number(digits) : null);
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.line}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[styles.big, StyleSheet.absoluteFill]}
                  />
                </View>
                <Text style={[type.bodyMedium, styles.unit]}>{t(UNIT[form])}</Text>
              </View>
            </View>
            <SquareButton
              icon="minus"
              label={t('medicine.less')}
              disabled={!draft.quantity}
              onPress={() => setQuantity((draft.quantity ?? 0) - 1 || null)}
            />
            <SquareButton
              icon="plus"
              label={t('medicine.more')}
              onPress={() => setQuantity((draft.quantity ?? 0) + 1)}
            />
          </View>
          {zero ? <Text style={[type.bodyMedium, styles.wrong]}>{t('confirm.zero')}</Text> : null}
          {sizes.length > 1 ? (
            <View style={styles.sizes}>
              {sizes.map((n) => (
                <View key={n} style={styles.fill}>
                  <Tile label={String(n)} picked={draft.quantity === n} onPress={() => setQuantity(n)} height={52} />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {ready ? (
            <Button
              label={t('add.addTo', { cabinet: cabinet.name })}
              icon="plus"
              onPress={save}
              disabled={saving || zero}
            />
          ) : (
            <Button
              label={t('confirm.setExpiry')}
              icon="calendar-check"
              onPress={() => router.push('/add/when')}
              disabled={zero}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SquareButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.square, disabled && styles.squareOff, pressed && styles.pressedSquare]}
    >
      <Icon name={icon} size={24} color={disabled ? colors.inkMuted : colors.primary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
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
  other: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    marginLeft: 64 + spacing.lg,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  has: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  expiry: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  quantity: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Bottom-aligned, not on the baseline: Android does not re-measure baseline text when it changes.
  quantityWrong: { borderColor: colors.danger },
  wrong: { color: colors.danger, marginTop: spacing.sm },
  amount: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  big: { ...type.hero, fontSize: 34, lineHeight: 42, minWidth: 24, padding: 0 },
  // A little extra room for the caret after the last digit.
  sizer: { opacity: 0, paddingRight: 4 },
  unit: { color: colors.inkMuted, marginBottom: 6 },
  square: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareOff: { backgroundColor: colors.surfaceSoft },
  pressedSquare: { opacity: 0.7 },
  sizes: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
