import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * In place of the add screens, for a member of a shared cabinet: the server
 * refuses what they add, so the app does not let them start.
 */
export function NoAddRights() {
  const t = useT();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('common.back')} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <Icon name="first-aid-kit" size={32} color={colors.primary} />
        </View>
        <Text style={[type.screenTitle, styles.center]}>{t('add.noRightsTitle')}</Text>
        <Text style={[type.bodyMedium, styles.center, styles.muted]}>{t('add.noRightsText')}</Text>
      </View>
      <View style={styles.footer}>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  muted: { color: colors.inkMuted },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
});
