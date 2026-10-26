import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import { invite, type Invite } from '@/data/sharing';
import { showCode } from '@/domain/sharing';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Toast } from '@/ui/Toast';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Запросити» (docs/screens.md): the cabinet's invite code, to send in any
 * messenger or read aloud. The first invite shares the cabinet, so it waits
 * for the server; without a connection the screen says so and tries again.
 */
export default function InviteScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cabinet = useCabinets()?.find((c) => c.id === id);
  const [code, setCode] = useState<Invite | 'waiting' | 'failed'>('waiting');
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    invite(id).then(setCode, () => setCode('failed'));
  }, [id, attempt]);
  const retry = () => {
    setCode('waiting');
    setAttempt((n) => n + 1);
  };

  if (!cabinet) return null;
  const ready = typeof code === 'object';

  const share = () => {
    if (!ready) return;
    void Share.share({ message: t('invite.message', { name: cabinet.name, code: showCode(code.code) }) });
  };
  const copy = async () => {
    if (!ready) return;
    await Clipboard.setStringAsync(code.code);
    setCopied(true);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('members.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <FitTitle>{t('invite.title', { name: cabinet.name })}</FitTitle>
        <Text style={[type.bodyMedium, styles.muted]}>{t('invite.subtitle')}</Text>

        <View style={styles.card}>
          <Text style={[type.secondaryStrong, styles.caption]}>{t('invite.code').toLocaleUpperCase()}</Text>
          {code === 'waiting' ? (
            <ActivityIndicator style={styles.waiting} color={colors.primary} size="large" />
          ) : code === 'failed' ? (
            <>
              <Text style={[type.bodyMedium, styles.center]}>{t('sharing.offline')}</Text>
              <Button label={t('sharing.retry')} variant="outline" onPress={retry} />
            </>
          ) : (
            <>
              <Text style={styles.code} selectable>
                {showCode(code.code)}
              </Text>
              <Text style={[type.label, styles.center]}>
                {t('invite.valid', {
                  day: code.expiresAt.getDate(),
                  month: t(`month.until.${code.expiresAt.getMonth() + 1}` as 'month.until.1', { year: '' }).trim(),
                })}
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={[type.label, styles.note]}>{t('invite.note')}</Text>
        <Button label={t('invite.share')} icon="share" onPress={share} disabled={!ready} />
        <Button label={t('invite.copy')} icon="copy" variant="secondary" onPress={copy} disabled={!ready} />
      </View>
      {copied ? <Toast text={t('invite.copied')} onHide={() => setCopied(false)} bottom={180} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  muted: { color: colors.inkMuted, marginTop: spacing.xs },
  center: { textAlign: 'center' },
  card: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  caption: { textAlign: 'center' },
  code: {
    ...type.hero,
    fontVariant: ['tabular-nums'],
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.primary,
  },
  waiting: { marginVertical: spacing.lg },
  note: { textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
});
