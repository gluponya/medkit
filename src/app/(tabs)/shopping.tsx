import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets, useCurrentCabinet } from '@/data/cabinets';
import { useSession } from '@/data/session';
import { addByHand, markBought, removeLine, unmarkBought, useCabinetNames, useShoppingList } from '@/data/shopping';
import type { ShoppingLine } from '@/domain/shopping';
import { UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const REASON_COLOR = {
  expired: colors.danger,
  out: colors.warning,
  low: colors.warning,
  manual: colors.inkMuted,
} as const;

/**
 * Shopping (docs/screens.md, "Shopping list"): one list over all cabinets.
 * «Купити» is what runs out or is out of date and what was added by hand;
 * a ticked line moves to «Додати в аптечку» until its pack is added or it is crossed out.
 */
export default function Shopping() {
  const t = useT();
  const list = useShoppingList();
  const names = useCabinetNames();
  const [adding, setAdding] = useState(false);

  if (!list) return null;

  const why = (l: ShoppingLine) => {
    if (l.reason === 'expired') return t('home.expired');
    if (l.reason === 'out') return t('shopping.out');
    if (l.reason === 'low')
      return t('home.lowStock', {
        count: l.stock ?? 0,
        unit: t(UNIT[l.form ?? 'other']),
      });
    return t('shopping.byHand');
  };
  const cabinetName = (l: ShoppingLine) => names.get(l.cabinetId) ?? '';
  // The typed-routes generator lists /medicine/[id] as a static path on Windows, so it is cast.
  const open = (l: ShoppingLine) => {
    if (l.medicineId) router.push(`/medicine/${l.medicineId}` as Href);
  };
  // The scanner is not built yet, so a bought pack is added through the Register search,
  // already searching for the line's name; «Ввести вручну» there keeps the name.
  const addPack = (l: ShoppingLine) => {
    useSession.getState().setCurrentCabinet(l.cabinetId);
    router.push({ pathname: '/add/search', params: { q: l.name } });
  };
  const empty = list.toBuy.length === 0 && list.bought.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[type.screenTitle, styles.fill]}>{t('shopping.title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shopping.add')}
            onPress={() => setAdding(true)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Icon name="plus" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {empty ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}>
              <Icon name="shopping-cart" size={32} color={colors.primary} />
            </View>
            <Text style={type.sectionTitle}>{t('shopping.empty')}</Text>
            <Button label={t('shopping.addByHand')} icon="plus" variant="secondary" onPress={() => setAdding(true)} />
          </View>
        ) : null}

        {list.toBuy.length > 0 ? (
          <>
            <SectionTitle title={t('shopping.toBuy')} count={list.toBuy.length} />
            <View style={styles.card}>
              {list.toBuy.map((l, i) => (
                <View key={l.key} style={styles.line}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: false }}
                    accessibilityLabel={t('shopping.markBought')}
                    onPress={() => void markBought(l, cabinetName(l))}
                    hitSlop={10}
                    style={({ pressed }) => [styles.circle, styles.circleOpen, pressed && styles.pressed]}
                  />
                  <View style={[styles.lineRest, i > 0 && styles.divided]}>
                    <Pressable
                      disabled={!l.medicineId}
                      onPress={() => open(l)}
                      style={({ pressed }) => [styles.lineBody, pressed && styles.pressed]}
                    >
                      <Text style={type.cardTitle}>{l.name}</Text>
                      <View style={styles.reason}>
                        {l.reason !== 'manual' ? (
                          <View style={[styles.dot, { backgroundColor: REASON_COLOR[l.reason] }]} />
                        ) : null}
                        <Text style={[type.label, { color: REASON_COLOR[l.reason] }]}>
                          {t('shopping.line', {
                            reason: why(l),
                            cabinet: cabinetName(l),
                          })}
                        </Text>
                      </View>
                      {l.rx ? (
                        <View style={styles.reason}>
                          <Icon name="prescription" size={18} color={colors.warning} />
                          <Text style={[type.secondaryStrong, styles.ink]}>{t('shopping.rx')}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                    <RemoveButton line={l} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {list.bought.length > 0 ? (
          <>
            <SectionTitle title={t('shopping.bought')} count={list.bought.length} />
            <View style={styles.card}>
              {list.bought.map((l, i) => (
                <View key={l.key} style={styles.line}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={t('shopping.unmarkBought')}
                    onPress={() => void unmarkBought(l)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.circle, styles.circleDone, pressed && styles.pressed]}
                  >
                    <Icon name="check" size={18} color={colors.white} strokeWidth={2.6} />
                  </Pressable>
                  <View style={[styles.lineRest, i > 0 && styles.divided]}>
                    <View style={[styles.lineBody, styles.boughtBody]}>
                      <View style={styles.boughtHead}>
                        <Text style={[type.cardTitle, styles.muted, styles.fill]}>{l.name}</Text>
                        <RemoveButton line={l} inline />
                      </View>
                      <Button
                        label={t('shopping.scanInto', {
                          cabinet: cabinetName(l),
                        })}
                        icon="plus"
                        variant="secondary"
                        height={48}
                        onPress={() => addPack(l)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      {adding ? <AddSheet onClose={() => setAdding(false)} /> : null}
    </SafeAreaView>
  );
}

/** × at the end of a line. */
function RemoveButton({ line, inline }: { line: ShoppingLine; inline?: boolean }) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('shopping.remove')}
      onPress={() => void removeLine(line)}
      hitSlop={12}
      style={({ pressed }) => [!inline && styles.remove, pressed && styles.pressed]}
    >
      <Icon name="x" size={20} color={colors.inkMuted} />
    </Pressable>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionTitle}>
      {/* flex: 1, or Android keeps the width of the title measured before and cuts «Купити». */}
      <Text style={[type.sectionTitle, styles.fill]}>{title}</Text>
      <Text style={type.secondaryStrong}>{count}</Text>
    </View>
  );
}

/** «+»: a name, and which cabinet it is for when there is more than one. */
function AddSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const cabinets = useCabinets() ?? [];
  const current = useCurrentCabinet();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const cabinetId = picked ?? current?.id ?? null;
  const ready = name.trim().length > 0 && cabinetId !== null;

  const add = async () => {
    if (!ready || cabinetId === null) return;
    await addByHand(cabinetId, name);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* The sheet rides on the keyboard, or the field and the button end up under it. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={type.sectionTitle}>{t('shopping.whatToBuy')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('shopping.namePlaceholder')}
            placeholderTextColor={colors.inkMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void add()}
            style={styles.input}
          />
          {cabinets.length > 1 ? (
            <View style={styles.chips}>
              {cabinets.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.id === cabinetId }}
                  onPress={() => setPicked(c.id)}
                  style={[styles.chip, c.id === cabinetId && styles.chipPicked]}
                >
                  <Text style={[type.bodyMedium, c.id === cabinetId && styles.white]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button label={t('shopping.addButton')} onPress={() => void add()} disabled={!ready} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  fill: { flex: 1 },
  white: { color: colors.white },
  ink: { color: colors.ink },
  muted: { color: colors.inkMuted },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { marginTop: 120, alignItems: 'center', gap: spacing.lg },
  emptyMark: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.lg,
  },
  // The divider starts after the circle, as in the design.
  lineRest: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: spacing.md,
  },
  lineBody: {
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingRight: spacing.lg,
  },
  boughtBody: { gap: spacing.md },
  boughtHead: { flexDirection: 'row', alignItems: 'center' },
  remove: { paddingTop: spacing.lg + 2, paddingRight: spacing.lg },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOpen: { borderWidth: 2, borderColor: colors.line },
  circleDone: { backgroundColor: colors.success },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(47,58,79,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    ...type.input,
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  chipPicked: { backgroundColor: colors.primary, borderColor: colors.primary },
});
