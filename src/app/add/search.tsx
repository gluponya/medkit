import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentCabinet } from '@/data/cabinets';
import { sameMedicine, useKnownMedicines } from '@/data/medicines';
import { registerBrands, searchRegister, type RegisterEntry } from '@/data/register';
import {
  brandOf,
  closeBrands,
  displayName,
  formWord,
  matchParts,
  searchText,
  singleInn,
  splitResults,
} from '@/domain/register';
import { useDraft, type AfterAdd } from '@/features/add/draft';
import { useChange } from '@/features/change/draft';
import { FORM_NAME } from '@/features/add/labels';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** Long enough to skip the letters typed in one go, short enough to feel instant. */
const PAUSE_MS = 150;

/**
 * Register search (docs/screens.md): the State Register by name and substance,
 * the typed part in bold, «Є в «Дім»» on what the cabinet has. Names with the
 * typed words come first; below, «Також містять …» lists the other brands with
 * that substance, and a brand opens its own search. Under the results, the
 * ways in for what is not there. Nothing found offers the names close to what
 * was typed («нуррфен» → «Нурофєн») and says why it may be missing.
 * Opened from «Змінити ліки», a pick goes to the comparison instead (J9).
 */
export default function SearchScreen() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  // then=reminder: opened from «Що нагадати прийняти?», so adding ends on the new reminder.
  // change=<medicine id>: opened from «Змінити ліки».
  const { q, then, change } = useLocalSearchParams<{ q?: string; then?: string; change?: string }>();
  // The medicine being changed is not «Є в «Дім»» for itself.
  const known = useKnownMedicines(cabinet?.id).filter((m) => m.id !== change);
  const after: AfterAdd = then === 'reminder' ? 'reminder' : 'medicine';
  const [query, setQuery] = useState(q ?? '');
  // The last search that came back; kept while the next one runs, so the list does not blink.
  const [found, setFound] = useState<{
    query: string;
    entries: RegisterEntry[];
    close: { brand: string; inn: string | null }[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    const text = query.trim();
    if (!text) return;
    let live = true;
    const timer = setTimeout(() => {
      searchRegister(text)
        .then(async (entries) => {
          // Nothing found is most often a typo: offer the names it is close to.
          const brands = entries.length === 0 ? closeBrands(text, await registerBrands()) : [];
          // Each with its substance, so a name that looks right can be told by what is in it.
          const close = await Promise.all(
            brands.map(async (brand) => ({ brand, inn: singleInn((await searchRegister(brand, 1))[0]?.inn ?? null) })),
          );
          if (!live) return;
          setFailed(false);
          setFound({ query: text, entries, close });
        })
        .catch((e: unknown) => {
          console.error('register search failed:', e);
          if (live) setFailed(true);
        });
    }, PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (entry: RegisterEntry) => {
    if (change) {
      useChange.getState().set({ target: { name: displayName(entry.name), form: entry.form, register: entry } });
      router.push({ pathname: '/medicine/[id]/change', params: { id: change } });
      return;
    }
    const draft = useDraft.getState();
    draft.reset();
    draft.set({ register: entry, name: displayName(entry.name), form: entry.form, then: after });
    router.push('/add/confirm');
  };

  const searchFor = (text: string) => {
    setQuery(text);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const byHand = () => {
    if (change) {
      useChange.getState().set({ target: null, name: query.trim(), form: null });
      router.push({ pathname: '/medicine/[id]/change-name', params: { id: change } });
      return;
    }
    const draft = useDraft.getState();
    draft.reset();
    draft.set({ name: query.trim(), then: after });
    router.push('/add/name');
  };

  const details = (e: RegisterEntry) =>
    [
      singleInn(e.inn) ?? t('search.several'),
      e.form === 'other' ? (formWord(e.formText) ?? t(FORM_NAME.other).toLocaleLowerCase()) : t(FORM_NAME[e.form]).toLocaleLowerCase(),
      e.strength,
    ]
      .filter(Boolean)
      .join(', ');

  const shown = query.trim() ? found : null;
  const entries = shown?.entries ?? [];
  const nothing = shown !== null && entries.length === 0;
  const { named, alsoContain } = splitResults(entries, shown?.query ?? '');
  // Only the very first search waits long: the Register is copied out of the app on first use.
  const waiting = query.trim() !== '' && found === null && !failed;
  const close = nothing ? shown.close : [];
  // «Є в «Дім»» on a brand row: any form of it is in the cabinet.
  const hasBrand = (name: string) => known.some((m) => searchText(brandOf(m.name)) === searchText(brandOf(name)));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={change ? t('common.back') : (cabinet?.name ?? t('common.back'))} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.screenTitle}>{t('search.title')}</Text>

        <View style={styles.field}>
          <Icon name="search" size={22} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
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
        {!waiting && entries.length > 0 ? (
          <Text style={[type.label, styles.hint]}>{t('search.hint')}</Text>
        ) : close.length > 0 ? (
          <Text style={[type.label, styles.hint]}>{t('search.noExact')}</Text>
        ) : null}

        {waiting ? (
          <ActivityIndicator style={styles.waiting} color={colors.primary} size="large" />
        ) : failed && query.trim() ? (
          <Text style={[type.bodyMedium, styles.failed]}>{t('search.failed')}</Text>
        ) : close.length > 0 ? (
          <>
            <Text style={[type.label, styles.alsoFirst]}>{t('search.close')}</Text>
            <View style={styles.card}>
              {close.map(({ brand, inn }, i) => (
                <Fragment key={brand}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => searchFor(brand)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.fill}>
                      <Text style={[type.sectionTitle, styles.name]}>{brand}</Text>
                      {inn ? <Text style={type.label}>{inn}</Text> : null}
                    </View>
                    <Icon name="chevron-right" size={22} />
                  </Pressable>
                </Fragment>
              ))}
            </View>
            <Text style={[type.label, styles.notListed]}>{t('search.notListed')}</Text>
            <View style={styles.card}>
              <WayIn icon="pencil" label={t('search.byHand')} onPress={byHand} />
            </View>
          </>
        ) : nothing && shown ? (
          <View style={styles.none}>
            <View style={styles.noneMark}>
              <Icon name="zoom-question" size={36} />
            </View>
            <Text style={[type.sectionTitle, styles.noneTitle]}>{t('search.noneTitle')}</Text>
            <Text style={[type.bodyMedium, styles.muted, styles.center]}>{t('search.noneText')}</Text>
            <View style={styles.noneButton}>
              <Button label={t('search.byHand')} icon="pencil" onPress={byHand} />
            </View>
          </View>
        ) : entries.length > 0 && shown ? (
          <>
            {named.length > 0 ? (
              <View style={[styles.card, styles.results]}>
                {named.map((e, i) => {
                  const name = displayName(e.name);
                  const has = cabinet ? sameMedicine(known, e.id, name) !== null : false;
                  return (
                    <Fragment key={e.id}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => pick(e)}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      >
                        <View style={styles.fill}>
                          <View style={styles.nameRow}>
                            <Text style={[type.sectionTitle, styles.name]}>
                              {matchParts(name, shown.query).map((part, j) => (
                                <Text key={j} style={part.match ? styles.match : styles.rest}>
                                  {part.text}
                                </Text>
                              ))}
                            </Text>
                            {has ? (
                              <View style={styles.chip}>
                                <Text style={type.secondaryStrong}>{t('search.inCabinet', { cabinet: cabinet?.name ?? '' })}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={type.label}>{details(e)}</Text>
                        </View>
                        <Icon name="chevron-right" size={22} />
                      </Pressable>
                    </Fragment>
                  );
                })}
              </View>
            ) : null}

            {alsoContain.length > 0 ? (
              <>
                <Text style={[type.label, named.length > 0 ? styles.notListed : styles.alsoFirst]}>
                  {t('search.alsoContain', { query: shown.query })}
                </Text>
                <View style={styles.card}>
                  {alsoContain.map((e, i) => (
                    <Fragment key={e.id}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => searchFor(brandOf(e.name))}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      >
                        <View style={styles.fill}>
                          <View style={styles.nameRow}>
                            <Text style={[type.sectionTitle, styles.name]}>{brandOf(e.name)}</Text>
                            {cabinet && hasBrand(e.name) ? (
                              <View style={styles.chip}>
                                <Text style={type.secondaryStrong}>{t('search.inCabinet', { cabinet: cabinet.name })}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={type.label}>{singleInn(e.inn) ?? t('search.several')}</Text>
                        </View>
                        <Icon name="chevron-right" size={22} />
                      </Pressable>
                    </Fragment>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[type.label, styles.notListed]}>{t('search.notListed')}</Text>
            <View style={styles.card}>
              <WayIn icon="camera" label={t('search.photo')} onPress={() => router.push('/soon')} />
              <View style={styles.divider} />
              <WayIn icon="pencil" label={t('search.byHand')} onPress={byHand} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function WayIn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.wayIn, pressed && styles.pressed]}>
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={[type.cardTitle, styles.primary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  center: { textAlign: 'center' },
  primary: { color: colors.primary, fontSize: 17 },
  field: {
    height: 58,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, height: '100%', fontSize: 18 },
  waiting: { marginTop: 64 },
  failed: { marginTop: spacing.xxl, color: colors.danger, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  results: { marginTop: spacing.xl },
  hint: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
  alsoFirst: { marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  pressed: { backgroundColor: colors.surfaceSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 2 },
  name: { flexShrink: 1 },
  match: { fontFamily: type.sectionTitle.fontFamily },
  rest: { fontFamily: type.bodyMedium.fontFamily },
  chip: {
    height: 26,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: spacing.lg },
  notListed: { marginTop: spacing.xxl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  wayIn: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
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
  noneButton: { alignSelf: 'stretch', marginTop: spacing.xxl },
});
