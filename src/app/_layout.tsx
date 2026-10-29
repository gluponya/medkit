import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '@/data/db/client';
import migrations from '@/data/db/migrations/migrations';
import { rescheduleDoses } from '@/data/notifications';
import { useSession } from '@/data/session';
import { startSync } from '@/data/sync';
import { useI18n, useT } from '@/i18n';
import { colors, spacing } from '@/ui/theme';
import { fontAssets, type } from '@/ui/typography';

// The system splash, in the app's background colour, stays until the first
// screen is ready to draw: nothing flashes between them.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useT();

  // The local database is the source of truth, so no screen is drawn before the
  // migrations have run.
  const { success, error } = useMigrations(db, migrations);
  useEffect(() => {
    if (error) console.error('migrations failed:', error.message, error.cause ?? '');
  }, [error]);

  // Nor before the stored language, the stored session and the typeface are
  // known: otherwise the text or the screen would change under the person a
  // frame later. A face that fails to load lets the app through in the system one.
  const languageReady = useI18n((s) => s.hydrated);
  const sessionReady = useSession((s) => s.hydrated);
  const [fontsLoaded, fontsError] = useFonts(fontAssets);
  const fontsReady = fontsLoaded || fontsError !== null;

  const ready = (success || error !== undefined) && languageReady && sessionReady && fontsReady;
  // TEMP: black-screen diagnosis.
  console.log('[boot]', JSON.stringify({ success, error: error?.message ?? null, languageReady, sessionReady, fontsLoaded, fontsError: fontsError?.message ?? null }));
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Scheduled notifications run only a week ahead, and packs change in many
  // places: lay them out again on every start and every return to the app.
  useEffect(() => {
    if (!success) return;
    void rescheduleDoses();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void rescheduleDoses();
    });
    return () => sub.remove();
  }, [success]);

  // Shared cabinets sync in the background; the screens only read SQLite.
  useEffect(() => (success ? startSync() : undefined), [success]);

  if (!ready) return null;

  if (error) {
    return (
      <View style={styles.failed}>
        <Text style={[type.body, styles.failedText]}>{t('migrations.failed')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  failed: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  failedText: { textAlign: 'center' },
});
