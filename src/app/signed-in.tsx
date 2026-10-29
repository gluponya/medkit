import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { finishTelegram, startTelegram } from '@/data/account';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Back from Telegram's sign-in in the browser (public/telegram-login.html):
 * its signed result goes to the server, and the app opens on Home with the
 * account's cabinets. «false» is Telegram's answer when the person declined.
 */
export default function SignedInScreen() {
  const t = useT();
  const { tgAuthResult } = useLocalSearchParams<{ tgAuthResult?: string }>();
  const declined = !tgAuthResult || tgAuthResult === 'false';
  const [rejected, setRejected] = useState(false);
  const failed = declined || rejected;

  useEffect(() => {
    if (!tgAuthResult || tgAuthResult === 'false') return;
    finishTelegram(tgAuthResult)
      .then(() => {
        router.dismissAll();
        router.replace('/');
      })
      .catch(() => setRejected(true));
  }, [tgAuthResult]);

  return (
    <FormScreen
      back={t('common.back')}
      title={t('signIn.title')}
      button={failed ? { label: t('signIn.again'), icon: 'send', onPress: () => void startTelegram() } : undefined}
    >
      {failed ? (
        <Text style={[type.bodyMedium, styles.error]}>{t('signIn.failed')}</Text>
      ) : (
        <ActivityIndicator style={styles.busy} color={colors.primary} />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  busy: { marginTop: spacing.lg },
  error: { color: colors.danger, textAlign: 'center' },
});
