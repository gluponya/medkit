import { router } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Запрошення вже не діє» (docs/screens.md): a code older than seven days.
 * Asking for a new one sends a message to whoever shared it.
 */
export default function JoinExpiredScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('common.back')} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <Icon name="clock-x" size={32} color={colors.warning} />
        </View>
        <Text style={[type.screenTitle, styles.center]}>{t('joinExpired.title')}</Text>
        <Text style={[type.bodyMedium, styles.center, styles.muted]}>{t('joinExpired.text')}</Text>
      </View>
      <View style={styles.footer}>
        <Button
          label={t('joinExpired.ask')}
          icon="send"
          onPress={() => void Share.share({ message: t('joinExpired.message') })}
        />
        <Button label={t('joinExpired.other')} variant="secondary" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  muted: { color: colors.inkMuted },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
});
