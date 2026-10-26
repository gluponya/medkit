import { router } from 'expo-router';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCabinets } from '@/data/cabinets';
import { useSession } from '@/data/session';
import { useT } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

import { AddCabinetRow, CabinetRows, JoinCabinetRow } from './CabinetRows';

/**
 * The cabinet switcher (docs/screens.md): the name on Home opens it. A row
 * makes that cabinet current; «Керувати» goes to the Cabinets screen.
 */
export function Switcher({ currentId, onClose }: { currentId: string; onClose: () => void }) {
  const t = useT();
  const cabinets = useCabinets();
  const setCurrent = useSession((s) => s.setCurrentCabinet);

  const go = (to: '/cabinets' | '/place' | '/join-code') => {
    onClose();
    router.push(to);
  };

  return (
    <Sheet onClose={onClose}>
      <View style={styles.head}>
        <Text style={[type.sectionTitle, styles.fill]}>{t('cabinets.title')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => go('/cabinets')}
          style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
        >
          <Icon name="settings" size={18} color={colors.primary} />
          <Text style={[type.cardTitle, styles.primary]}>{t('cabinets.manage')}</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.list} bounces={false}>
        {cabinets ? (
          <CabinetRows
            cabinets={cabinets}
            currentId={currentId}
            onPick={(c) => {
              setCurrent(c.id);
              onClose();
            }}
          />
        ) : null}
        <AddCabinetRow onPress={() => go('/place')} />
        <JoinCabinetRow onPress={() => go('/join-code')} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fill: { flex: 1 },
  manage: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  primary: { color: colors.primary },
  list: { maxHeight: 440 },
});
