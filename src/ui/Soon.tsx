import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';

import { Icon } from './Icon';
import { colors, spacing } from './theme';
import { type } from './typography';

/**
 * Stands in for a screen that is not built yet, so every button leads somewhere.
 * Opened on top of another screen it has «Назад»; as a tab it does not need one.
 */
export function Soon({ back = false }: { back?: boolean }) {
  const t = useT();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {back ? (
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Icon name="chevron-left" size={24} color={colors.primary} strokeWidth={2} />
            <Text style={[type.cardTitle, styles.backText]}>{t('common.back')}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.middle}>
        <Icon name="clock" size={32} />
        <Text style={[type.sectionTitle, styles.title]}>{t('soon.title')}</Text>
        <Text style={[type.bodyMedium, styles.text]}>{t('soon.text')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.primary, fontSize: 17 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  title: { marginTop: spacing.md },
  text: { marginTop: spacing.xs, color: colors.inkMuted, textAlign: 'center' },
});
