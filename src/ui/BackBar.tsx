import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, spacing } from './theme';
import { type } from './typography';

/** The top bar of a pushed screen: ‹ and where it goes back to, an action on the right. */
export function BackBar({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <Icon name="chevron-left" size={24} color={colors.primary} strokeWidth={2} />
        <Text style={[type.cardTitle, styles.label]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  label: { color: colors.primary, fontSize: 17 },
});
