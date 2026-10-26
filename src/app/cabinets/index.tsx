import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import { AddCabinetRow, CabinetRows, JoinCabinetRow } from '@/features/cabinets/CabinetRows';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** Cabinets (docs/screens.md): every cabinet, each opens its settings. */
export default function CabinetsScreen() {
  const t = useT();
  const cabinets = useCabinets();
  if (!cabinets) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.screenTitle, styles.title]}>{t('cabinets.title')}</Text>
        {/* The typed-routes generator lists /cabinets/[id] as a static path on Windows, so it is cast. */}
        <CabinetRows cabinets={cabinets} onPick={(c) => router.push(`/cabinets/${c.id}` as Href)} />
        <AddCabinetRow onPress={() => router.push('/place')} />
        <JoinCabinetRow onPress={() => router.push('/join-code')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  title: { marginBottom: spacing.lg },
});
