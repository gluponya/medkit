import { StyleSheet, Text, View } from 'react-native';

import { useBodyTime } from '@/data/body-time';
import { bodyTime } from '@/domain/body-time';
import { localDay } from '@/domain/expiry';
import { useT } from '@/i18n';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * «В організмі» (docs/journeys.md, J8): the last dose, when it is gone, whether
 * a course builds it up, and the instruction's words about alcohol. Dates and
 * quotes only: it never says whether drinking is fine.
 */
export function BodyTime({ medicineId, registerId }: { medicineId: string; registerId: string | null }) {
  const t = useT();
  const found = useBodyTime(medicineId, registerId);
  if (!found) return null;
  const { facts, taken } = found;
  const b = bodyTime(facts, taken);
  const now = new Date();

  const when = (d: Date) => {
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const days = Math.round((Date.parse(localDay(d)) - Date.parse(localDay(now))) / 86_400_000);
    if (days === 0) return t('body.today', { time });
    if (days === 1) return t('body.tomorrow', { time });
    if (days === -1) return t('body.yesterday', { time });
    return t('body.date', { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`, time });
  };
  const duration =
    b.clearHours < 48
      ? t('body.hours', { count: Math.ceil(b.clearHours) })
      : t('body.days', { count: Math.ceil(b.clearHours / 24) });

  const lines = [
    b.lastDose ? t('body.lastDose', { when: when(b.lastDose) }) : null,
    b.goneBy
      ? t(b.goneBy > now ? 'body.goneBy' : 'body.gone', { when: when(b.goneBy) })
      : t('body.clears', { duration }),
    b.buildsUp ? t('body.buildsUp') : null,
  ].filter((l): l is string => l !== null);

  return (
    <>
      <Text style={[type.sectionTitle, styles.title]}>{t('body.title')}</Text>
      <View style={styles.card}>
        {lines.map((l) => (
          <Text key={l} style={type.bodyMedium}>
            {l}
          </Text>
        ))}
        <View style={styles.alcohol}>
          <Text style={type.label}>{t('body.alcohol')}</Text>
          <Text style={type.bodyMedium}>
            {facts.alcoholQuote ? `«${facts.alcoholQuote}»` : t('body.alcoholNone')}
          </Text>
          {b.alcoholFrom && b.alcoholFrom > now ? (
            <Text style={type.bodyMedium}>{t('body.alcoholWait', { when: when(b.alcoholFrom) })}</Text>
          ) : null}
        </View>
        <Text style={[type.bodyMedium, styles.muted]}>{t('body.average')}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...cardShadow,
  },
  alcohol: { gap: spacing.xs, marginTop: spacing.sm },
  muted: { color: colors.inkMuted, marginTop: spacing.sm },
});
