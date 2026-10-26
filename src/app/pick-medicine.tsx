import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentCabinet } from '@/data/cabinets';
import { useCabinetMedicines, type Medicine } from '@/data/medicines';
import { useRemindedMedicines } from '@/data/reminders';
import { searchText } from '@/domain/register';
import { FORM_NAME } from '@/features/add/labels';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** From this many medicines the list gets a search field. */
const MANY = 8;

/**
 * Pick a medicine (docs/screens.md): «Додати нагадування» from Today or First
 * steps asks which medicine first. A picked one opens its New reminder over
 * its Medicine screen; «Додати нові ліки» adds one and ends there as well.
 */
export default function PickMedicineScreen() {
  const t = useT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const cabinet = useCurrentCabinet();
  const medicines = useCabinetMedicines(cabinet?.id);
  const reminded = useRemindedMedicines(cabinet?.id);
  const [query, setQuery] = useState('');

  if (!cabinet || !medicines) return null;

  const key = searchText(query.trim());
  const shown = key
    ? medicines.filter((m) => searchText([m.name, m.inn].filter(Boolean).join(' ')).includes(key))
    : medicines;

  const details = (m: Medicine) =>
    [m.inn, t(FORM_NAME[m.form ?? 'other']).toLocaleLowerCase(), m.strength].filter(Boolean).join(', ');

  const pick = (m: Medicine) => {
    router.replace({ pathname: '/medicine/[id]', params: { id: m.id } });
    router.push({ pathname: '/medicine/[id]/reminder', params: { id: m.id } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={from === 'today' ? t('today.title') : cabinet.name} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.screenTitle}>{t('pickMedicine.title')}</Text>
        <Text style={[type.bodyMedium, styles.muted, styles.lead]}>
          {medicines.length === 0
            ? t('pickMedicine.empty', { cabinet: cabinet.name })
            : t('pickMedicine.from', { cabinet: cabinet.name })}
        </Text>

        {medicines.length >= MANY ? (
          <View style={styles.search}>
            <Icon name="search" size={20} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('pickMedicine.search')}
              placeholderTextColor={colors.inkMuted}
              style={[type.input, styles.fill]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={80}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/add/search', params: { then: 'reminder' } })}
          style={({ pressed }) => [styles.addNew, pressed && styles.pressed]}
        >
          <Icon name="plus" size={22} color={colors.primary} />
          <Text style={[type.stepTitle, styles.primary, styles.fill]}>{t('pickMedicine.addNew')}</Text>
          <Icon name="chevron-right" size={20} />
        </Pressable>

        {shown.length > 0 ? (
          <View style={styles.card}>
            {shown.map((m, i) => (
              <Fragment key={m.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => pick(m)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.fill}>
                    <View style={styles.title}>
                      <Text style={[type.cardTitle, styles.shrink]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {reminded.has(m.id) ? (
                        <View style={styles.badge}>
                          <Text style={[type.caption, styles.muted]}>{t('pickMedicine.hasReminder')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={type.secondary} numberOfLines={1}>
                      {details(m)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} />
                </Pressable>
              </Fragment>
            ))}
          </View>
        ) : key ? (
          <Text style={[type.bodyMedium, styles.muted, styles.nothing]}>{t('pickMedicine.nothing')}</Text>
        ) : null}
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
  lead: { marginTop: spacing.xs },
  search: {
    marginTop: spacing.lg,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addNew: {
    marginTop: spacing.lg,
    height: 56,
    paddingLeft: 14,
    paddingRight: spacing.md,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  row: {
    minHeight: 64,
    paddingLeft: 14,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 14 },
  pressed: { opacity: 0.7 },
  nothing: { marginTop: spacing.lg },
});
