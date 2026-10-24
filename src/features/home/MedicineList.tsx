import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { expiryMonth } from '@/domain/expiry';
import type { Overview } from '@/domain/overview';
import { FORM_ICON, UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Attention = Overview['attention'][number];

/**
 * Home's list (docs/screens.md, "Home"): «Потребує уваги» as a card, worst
 * first, then every other medicine with its date.
 */
export function MedicineList({
  overview,
  onOpen,
  onTags,
}: {
  overview: Overview;
  onOpen: (id: string) => void;
  onTags: () => void;
}) {
  const t = useT();

  const reasonText = (m: Attention) =>
    m.reason === 'expired'
      ? t('home.expired')
      : m.reason === 'expiring'
        ? t('home.expiresIn', { count: m.daysLeft ?? 0 })
        : t('home.lowStock', { count: m.stock ?? 0, unit: t(UNIT[m.form ?? 'other']) });

  const until = (expires: string | null) => {
    if (!expires) return '';
    const { year, month } = expiryMonth(expires);
    return t('home.until', { date: `${String(month).padStart(2, '0')}.${year}` });
  };

  return (
    <View>
      {overview.attention.length > 0 ? (
        <>
          <View style={styles.titleRow}>
            <Text style={type.sectionTitle}>{t('home.attention')}</Text>
            <Text style={type.secondaryStrong}>{overview.attention.length}</Text>
          </View>
          <View style={styles.card}>
            {overview.attention.map((m, i) => {
              const tone = m.reason === 'expired' ? colors.danger : colors.warning;
              return (
                <Fragment key={m.id}>
                  {i > 0 ? <View style={styles.cardDivider} /> : null}
                  <Pressable accessibilityRole="button" onPress={() => onOpen(m.id)} style={styles.attentionRow}>
                    <View style={[styles.dot, { backgroundColor: tone }]} />
                    <Text style={[type.cardTitle, styles.fill]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[type.secondaryStrong, { color: tone }]}>{reasonText(m)}</Text>
                    <Icon name="chevron-right" size={18} />
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        </>
      ) : null}

      {overview.rest.length > 0 ? (
        <>
          <View style={[styles.titleRow, styles.allRow]}>
            <View style={styles.allTitle}>
              <Text style={[type.secondaryStrong, styles.upper]}>{t('home.all')}</Text>
              <Text style={type.secondaryStrong}>{overview.total}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onTags} style={styles.tags} hitSlop={8}>
              <Icon name="adjustments" size={18} color={colors.primary} />
              <Text style={[type.secondaryStrong, styles.primary]}>{t('home.tags')}</Text>
            </Pressable>
          </View>
          {overview.rest.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => onOpen(m.id)} style={styles.row}>
              <Icon name={FORM_ICON[m.form ?? 'other']} size={22} />
              <Text style={[type.cardTitle, styles.fill]} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={type.secondary}>{until(m.expires)}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  allRow: { alignItems: 'center', marginBottom: 0 },
  allTitle: { flexDirection: 'row', gap: spacing.sm },
  upper: { textTransform: 'uppercase', letterSpacing: 0.4 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primary: { color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  cardDivider: { height: 1, backgroundColor: colors.line, marginLeft: spacing.md + 10 + spacing.md },
  attentionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  fill: { flex: 1 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
