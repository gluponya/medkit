import { useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * The camera, asked for the moment its screen opens: she tapped to scan or
 * photograph, so the reason is plain and the phone's own question comes
 * straight away. `asking` while it is up, `off` once refused.
 */
export function useCamera() {
  const [permission, request, get] = useCameraPermissions();
  const asked = useRef(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || asked.current) return;
    asked.current = true;
    void request().finally(() => setAnswered(true));
  }, [permission, request]);

  // Back from Settings, the camera may be on now.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void get();
    });
    return () => sub.remove();
  }, [get]);

  const state: 'asking' | 'on' | 'off' = !permission
    ? 'asking'
    : permission.granted
      ? 'on'
      : !permission.canAskAgain || answered
        ? 'off'
        : 'asking';
  return { state, canAskAgain: permission?.canAskAgain ?? false, request };
}

/**
 * The camera was refused. iOS asks only once: after that only Settings can
 * turn it on. Android may ask again, so there the button asks.
 */
export function CameraOff({
  text,
  canAskAgain,
  onAllow,
  onClose,
  onByName,
}: {
  text: string;
  canAskAgain: boolean;
  onAllow: () => void;
  onClose: () => void;
  /** The way on without the camera, when the screen before it is not already that. */
  onByName?: () => void;
}) {
  const t = useT();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <Close onPress={onClose} />
      </View>
      <View style={styles.middle}>
        <View style={styles.mark}>
          <Icon name="camera-off" size={40} color={colors.white} />
        </View>
        <Text style={[type.screenTitle, styles.light, styles.center]}>{t('camera.offTitle')}</Text>
        <Text style={[type.lead, styles.muted, styles.center]}>{text}</Text>
      </View>
      <View style={styles.buttons}>
        {canAskAgain ? (
          <Button label={t('photo.allow')} icon="camera" onPress={onAllow} />
        ) : (
          <Button label={t('photo.openSettings')} icon="settings" onPress={() => void Linking.openSettings()} />
        )}
        {onByName ? <Button label={t('box.byName')} icon="search" variant="night" onPress={onByName} /> : null}
      </View>
    </SafeAreaView>
  );
}

/** The dark screen under the phone's own question, with a way out. */
export function CameraAsking({ onClose }: { onClose: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <Close onPress={onClose} />
      </View>
    </SafeAreaView>
  );
}

function Close({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.close')}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      <Icon name="x" size={24} color={colors.white} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  light: { color: colors.white },
  muted: { color: colors.nightMuted },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  bar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
  },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  mark: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
  },
  buttons: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
