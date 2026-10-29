import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { appleAvailable, signInWithApple, startTelegram, useAccount } from '@/data/account';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { FormScreen } from '@/ui/FormScreen';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Зберегти доступ» (docs/screens.md, "Sign in"): Telegram, the same account as
 * the mini app, and Apple on an iPhone. Signed in, it says with what.
 */
export default function SignInScreen() {
  const t = useT();
  const account = useAccount();
  const [apple, setApple] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  useEffect(() => {
    void appleAvailable().then(setApple);
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setState('busy');
    try {
      const done = await fn();
      setState('idle');
      if (done === true) {
        router.dismissAll();
        router.replace('/');
      }
    } catch {
      setState('failed');
    }
  };

  if (account) {
    return (
      <FormScreen
        back={t('common.back')}
        title={t('signIn.done', { provider: t(`signIn.${account}`) })}
        subtitle={t('signIn.doneText')}
      >
        {null}
      </FormScreen>
    );
  }

  return (
    <FormScreen back={t('common.back')} title={t('signIn.title')} subtitle={t('signIn.subtitle')}>
      <Button label={t('signIn.withTelegram')} icon="send" onPress={() => void run(startTelegram)} />
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.button}
          style={styles.apple}
          onPress={() => void run(signInWithApple)}
        />
      ) : null}
      {state === 'busy' ? <ActivityIndicator style={styles.status} color={colors.primary} /> : null}
      {state === 'failed' ? <Text style={[type.bodyMedium, styles.status, styles.error]}>{t('signIn.failed')}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  apple: { height: 52, marginTop: spacing.md },
  status: { marginTop: spacing.lg, textAlign: 'center' },
  error: { color: colors.danger },
});
