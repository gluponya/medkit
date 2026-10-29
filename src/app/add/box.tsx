import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchRegister, type RegisterEntry } from '@/data/register';
import { boxQuery, rankForBox } from '@/domain/box';
import { displayName, formWord, singleInn } from '@/domain/register';
import { useBoxPhotos } from '@/features/add/boxPhotos';
import { useDraft, type AfterAdd } from '@/features/add/draft';
import { FORM_NAME } from '@/features/add/labels';
import { useScan } from '@/features/add/scan';
import { shownStrength } from '@/features/medicine/strength';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon, type IconName } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** «Схожі» under the best match: a few, the box is in hand to compare with. */
const OTHERS = 3;

/**
 * «Це ці ліки?» (13-photo-4-result): the Register's entries for what the box
 * says, the likeliest one big with «Так, це вони», a few like it below. The
 * expiry read off the flap goes along to «Додати в «Дім»», where it can still
 * be changed. Nothing here is saved; the person confirms the entry.
 */
export default function BoxScreen() {
  const t = useT();
  const { then } = useLocalSearchParams<{ then?: string }>();
  const after: AfterAdd = then === 'reminder' ? 'reminder' : 'medicine';
  const reading = useBoxPhotos((s) => s.reading);
  const [found, setFound] = useState<RegisterEntry[] | null>(null);
  const query = reading ? boxQuery(reading) : null;

  useEffect(() => {
    if (!query) return;
    let live = true;
    searchRegister(query, 30)
      .then((entries) => live && setFound(entries))
      .catch((e: unknown) => {
        console.error('register search failed:', e);
        if (live) setFound([]);
      });
    return () => {
      live = false;
    };
  }, [query]);

  if (!reading) return null;

  const { best, others } = rankForBox(found ?? [], reading);
  // A DataMatrix's date is surer than one read off the flap.
  const expires = useScan.getState().scan?.expires ?? reading.expires;

  const fill = () => {
    const draft = useDraft.getState();
    draft.reset();
    draft.set({ then: after, year: expires?.year ?? null, month: expires?.month ?? null, quantity: reading.packSize });
    return draft;
  };

  const pick = (entry: RegisterEntry) => {
    fill().set({ register: entry, name: displayName(entry.name), form: entry.form });
    router.push('/add/confirm');
  };

  const byHand = () => {
    fill().set({ name: reading.name ?? '', form: reading.form });
    router.push('/add/name');
  };

  const byName = () => router.replace({ pathname: '/add/search', params: { q: query ?? '', then } });

  const details = (e: RegisterEntry) =>
    [
      singleInn(e.inn) ?? t('search.several'),
      e.form === 'other' ? (formWord(e.formText) ?? t(FORM_NAME.other).toLocaleLowerCase()) : t(FORM_NAME[e.form]).toLocaleLowerCase(),
      shownStrength(e.strength),
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <BackBar label={t('common.back')} />
      <ScrollView contentContainerStyle={styles.content}>
        {found === null ? (
          <ActivityIndicator style={styles.waiting} color={colors.primary} size="large" />
        ) : (
          <>
            <FitTitle style={type.screenTitle}>{t(found.length > 0 ? 'box.title' : 'box.noneTitle')}</FitTitle>
            <Text style={[type.lead, styles.lead]}>
              {found.length > 0 ? t('box.subtitle') : t('box.noneText', { name: query ?? '' })}
            </Text>

            {best ? (
              <View style={[styles.card, styles.best]}>
                <View style={styles.bestTop}>
                  <View style={styles.fill}>
                    <Text style={type.sectionTitle}>{displayName(best.name)}</Text>
                    <Text style={type.label}>{details(best)}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={[type.caption, styles.chipText]}>{t('box.best')}</Text>
                  </View>
                </View>
                {expires ? (
                  <>
                    <View style={styles.line} />
                    <View style={styles.expiry}>
                      <Icon name="calendar-time" size={22} />
                      <Text style={[type.bodyMedium, styles.fill]}>
                        {t('box.expires', { date: `${String(expires.month).padStart(2, '0')}.${expires.year}` })}
                      </Text>
                    </View>
                  </>
                ) : null}
                <Button label={t('box.yes')} icon="check" onPress={() => pick(best)} />
              </View>
            ) : null}

            {others.length > 0 ? (
              <>
                <Text style={[type.label, styles.section]}>{t(best ? 'box.similar' : 'box.maybe')}</Text>
                <View style={styles.card}>
                  {others.slice(0, OTHERS).map((e, i) => (
                    <Fragment key={e.id}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => pick(e)}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      >
                        <View style={styles.fill}>
                          <Text style={type.sectionTitle}>{displayName(e.name)}</Text>
                          <Text style={type.label}>{details(e)}</Text>
                        </View>
                        <Icon name="chevron-right" size={22} />
                      </Pressable>
                    </Fragment>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[type.label, styles.section]}>{t(found.length > 0 ? 'box.notAmong' : 'search.otherWays')}</Text>
            <View style={styles.card}>
              <WayIn icon="search" label={t('box.byName')} onPress={byName} />
              <View style={styles.divider} />
              <WayIn icon="pencil" label={t('search.byHand')} onPress={byHand} />
            </View>
          </>
        )}
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
  waiting: { marginTop: 64 },
  lead: { marginTop: spacing.xs, marginBottom: spacing.xl },
  primary: { color: colors.primary, fontSize: 17 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  best: { borderWidth: 2, borderColor: colors.primary, padding: spacing.lg, gap: spacing.lg },
  bestTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  chip: {
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  chipText: { color: colors.primary },
  line: { height: 1, backgroundColor: colors.line },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { marginTop: spacing.xxl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  pressed: { backgroundColor: colors.surfaceSoft },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: spacing.lg },
  wayIn: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
});
