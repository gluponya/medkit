import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets, useCurrentCabinet } from '@/data/cabinets';
import { useCustomCategories } from '@/data/categories';
import { useFindables } from '@/data/search';
import { CATEGORIES } from '@/domain/categories';
import { expiryMonth, localDay } from '@/domain/expiry';
import { categoryCounts, findMedicines, type Found } from '@/domain/find';
import { matchParts } from '@/domain/register';
import { CATEGORY_ICON, CATEGORY_NAME, FORM_NAME } from '@/features/add/labels';
import { ownIcon } from '@/features/categories/categories';
import { shownStrength } from '@/features/medicine/strength';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { FitText } from '@/ui/FitText';
import { Icon, type IconName } from '@/ui/Icon';
import { PressScale } from '@/ui/motion';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Search (docs/screens.md, "Search results"): the person's own medicines in
 * every cabinet, by name, substance or category. No keyboard at first, so the
 * categories are there for a quick pick; only those with medicines are shown.
 * Results go by cabinet, this one first, expired ones greyed. Nothing found
 * offers adding it, through the Register search.
 */
export default function FindScreen() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const cabinets = useCabinets() ?? [];
  const items = useFindables();
  const own = useCustomCategories();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  // One size for every tile: the smallest a long word needed, so no tile reads smaller than the rest.
  const [tileSize, setTileSize] = useState(type.cardTitle.fontSize);

  const counts = useMemo(() => categoryCounts(items), [items]);
  const tiles: { key: string; label: string; icon: IconName }[] = [
    ...CATEGORIES.map((c) => ({ key: c as string, label: t(CATEGORY_NAME[c]), icon: CATEGORY_ICON[c] })),
    ...own.map((c) => ({ key: c.id, label: c.name, icon: ownIcon(c.icon) })),
  ].filter((tile) => (counts.get(tile.key) ?? 0) > 0);
  const picked = tiles.find((tile) => tile.key === category);

  const today = localDay(new Date());
  const groups = findMedicines(
    items,
    { query, category },
    cabinets.map((c) => c.id),
    cabinet?.id ?? null,
    today,
    (id) => cabinets.find((c) => c.id === id)?.expiryWarningDays ?? 30,
  );
  const asked = query.trim() !== '' || category !== null;

  const details = (m: Found) =>
    [m.inn, m.form ? t(FORM_NAME[m.form]).toLocaleLowerCase() : null, shownStrength(m.strength)].filter(Boolean).join(', ');

  const dateText = (m: Found) => {
    if (m.status === 'expired') return t('home.expired');
    if (!m.expires) return '';
    const { year, month } = expiryMonth(m.expires);
    return t('home.until', { date: `${String(month).padStart(2, '0')}.${year}` });
  };

  const bold = (text: string, style: object) =>
    query.trim()
      ? matchParts(text, query).map((part, i) => (
          <Text key={i} style={part.match ? style : null}>
            {part.text}
          </Text>
        ))
      : text;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={cabinet?.name ?? t('common.back')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.screenTitle}>{t('find.title')}</Text>

        <View style={[styles.field, asked && styles.fieldOn]}>
          <Icon name="search" size={22} />
          {picked ? (
            <View style={styles.chip}>
              <Icon name={picked.icon} size={18} color={colors.primary} />
              <Text style={[type.cardTitle, styles.primary]} numberOfLines={1}>
                {picked.label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('find.removeCategory')}
                onPress={() => setCategory(null)}
                hitSlop={8}
                style={styles.chipX}
              >
                <Icon name="x" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={picked ? '' : t('search.placeholder')}
            placeholderTextColor={colors.inkMuted}
            style={[type.input, styles.input]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={80}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('search.clear')} onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="circle-x" size={24} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        {!asked ? (
          <>
            {cabinets.length > 1 ? <Text style={[type.secondary, styles.where]}>{t('find.where')}</Text> : null}
            {tiles.length > 0 ? (
              <>
                <Text style={[type.secondaryStrong, styles.section]}>{t('find.categories')}</Text>
                <View style={styles.grid}>
                  {tiles.map((tile) => (
                    <PressScale
                      key={tile.key}
                      accessibilityRole="button"
                      onPress={() => setCategory(tile.key)}
                      outerStyle={styles.tileCell}
                      style={styles.tile}
                    >
                      <Icon name={tile.icon} size={22} color={colors.primary} />
                      <FitText
                        style={[type.cardTitle, styles.fill]}
                        minSize={12}
                        cap={tileSize}
                        onFit={(size) => setTileSize((s) => Math.min(s, size))}
                      >
                        {tile.label}
                      </FitText>
                      <View style={styles.count}>
                        <Text style={[type.caption, styles.muted]}>{counts.get(tile.key)}</Text>
                      </View>
                    </PressScale>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : groups.length > 0 ? (
          groups.map((g, gi) => {
            const c = cabinets.find((x) => x.id === g.cabinetId);
            if (!c) return null;
            return (
              <Fragment key={g.cabinetId}>
                <View style={[styles.cabinet, gi === 0 && styles.cabinetFirst]}>
                  <Icon name={c.icon} size={16} />
                  <Text style={type.secondaryStrong} numberOfLines={1}>
                    {c.id === cabinet?.id ? t('find.thisCabinet', { cabinet: c.name }) : c.name}
                  </Text>
                </View>
                <View style={styles.card}>
                  {g.medicines.map((m, i) => {
                    const expired = m.status === 'expired';
                    const tone = expired ? colors.danger : m.status === 'expiring' ? colors.warning : colors.inkMuted;
                    return (
                      <Fragment key={m.id}>
                        {i > 0 ? <View style={styles.divider} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })}
                          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                        >
                          <View style={[styles.fill, expired && styles.dim]}>
                            <Text style={type.cardTitle} numberOfLines={1}>
                              {bold(m.name, styles.matchName)}
                            </Text>
                            {details(m) ? (
                              <Text style={type.secondary} numberOfLines={1}>
                                {bold(details(m), styles.matchDetails)}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[type.secondaryStrong, { color: tone }]}>{dateText(m)}</Text>
                          <Icon name="chevron-right" size={18} />
                        </Pressable>
                      </Fragment>
                    );
                  })}
                </View>
              </Fragment>
            );
          })
        ) : (
          <View style={styles.none}>
            <View style={styles.noneMark}>
              <Icon name="zoom-question" size={36} />
            </View>
            <Text style={[type.sectionTitle, styles.noneTitle]}>{t('find.noneTitle')}</Text>
            <Text style={[type.bodyMedium, styles.muted]}>{t('find.noneText')}</Text>
            {query.trim() ? (
              <PressScale
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/add/search', params: { q: query.trim() } })}
                style={styles.add}
              >
                <Icon name="plus" size={20} color={colors.primary} />
                <Text style={[type.button, styles.primary, styles.shrink]} numberOfLines={1}>
                  {t('find.add', { name: query.trim() })}
                </Text>
              </PressScale>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  muted: { color: colors.inkMuted },
  primary: { color: colors.primary },
  field: {
    height: 56,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  fieldOn: { borderWidth: 2, borderColor: colors.primary, paddingHorizontal: spacing.md - 1 },
  input: { flex: 1, height: '100%' },
  chip: {
    height: 32,
    maxWidth: '75%',
    paddingLeft: 10,
    paddingRight: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipX: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  where: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tileCell: { width: '48%', flexGrow: 1 },
  tile: {
    minHeight: 56,
    paddingLeft: spacing.md,
    paddingRight: 10,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinet: {
    marginTop: spacing.xl,
    marginBottom: 6,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cabinetFirst: { marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: 14, paddingRight: spacing.md },
  pressed: { backgroundColor: colors.surfaceSoft },
  dim: { opacity: 0.55 },
  matchName: { fontFamily: type.stepTitle.fontFamily },
  matchDetails: { fontFamily: type.secondaryStrong.fontFamily, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 14 },
  none: { marginTop: 64, alignItems: 'center' },
  noneMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noneTitle: { marginTop: spacing.xl, fontSize: 20, marginBottom: spacing.xs, textAlign: 'center' },
  add: {
    alignSelf: 'stretch',
    marginTop: spacing.xxl,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
