import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { motion, PressScale } from '@/ui/motion';
import { colors } from '@/ui/theme';
import { type } from '@/ui/typography';

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={24} color={String(color)} />;
  };
}

/**
 * A tab that settles a little under the finger instead of the system ripple,
 * which on Android spreads a grey circle over the bar.
 */
function TabButton({ style, children, android_ripple: _ripple, pressOpacity: _opacity, hoverEffect: _hover, ...rest }: BottomTabBarButtonProps) {
  return (
    <PressScale {...rest} scaleTo={0.92} outerStyle={style} style={styles.fill}>
      {children}
    </PressScale>
  );
}

/** Four tabs with icons and labels (design system, "Navigation"). */
export default function TabsLayout() {
  const t = useT();
  // Room for the system buttons or the gesture bar under the tabs.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 60 + bottom, paddingTop: 8, paddingBottom: bottom + 6 },
        tabBarLabelStyle: { ...type.caption, marginTop: 2 },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarButton: TabButton,
        // Screens cross-fade, briefly, instead of swapping at once.
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: motion.fade } },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.cabinet'), tabBarIcon: tabIcon('first-aid-kit') }} />
      <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: tabIcon('calendar-check') }} />
      <Tabs.Screen name="shopping" options={{ title: t('tabs.shopping'), tabBarIcon: tabIcon('shopping-cart') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
