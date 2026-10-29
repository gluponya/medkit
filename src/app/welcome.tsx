import { router } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** The first screen of the first launch (docs/screens.md, "Welcome"). No account needed. */
export default function Welcome() {
  const t = useT();

  // The terms sentence carries two links inside it; they lead nowhere until
  // the pages exist, so for now they are only coloured.
  const [beforeTerms, rest] = t('welcome.terms').split('{terms}');
  const [between, afterPrivacy] = rest.split('{privacy}');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.middle}>
        <View style={styles.mark}>
          <Icon name="first-aid-kit" size={52} color={colors.white} strokeWidth={2} />
        </View>
        <Text style={[type.hero, styles.center]}>{t('app.name')}</Text>
        <Text style={[type.lead, styles.center, styles.tagline]}>{t('welcome.tagline')}</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={[type.bodyMedium, styles.center, styles.muted]}>{t('welcome.local')}</Text>
        <Button label={t('welcome.start')} onPress={() => router.push('/place')} />
        <Button label={t('welcome.invite')} icon="users" variant="secondary" onPress={() => router.push('/join-code')} />
        {/* A new phone of someone who signed in. The Telegram mini app (web) is signed in already. */}
        {Platform.OS === 'web' ? null : (
          <Button label={t('welcome.signIn')} variant="outline" onPress={() => router.push('/sign-in')} />
        )}
        <Text style={[type.secondary, styles.center, styles.terms]}>
          {beforeTerms}
          <Text style={styles.link}>{t('welcome.termsLink')}</Text>
          {between}
          <Text style={styles.link}>{t('welcome.privacyLink')}</Text>
          {afterPrivacy}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  center: { textAlign: 'center' },
  tagline: { marginTop: spacing.md },
  bottom: { gap: spacing.md, paddingBottom: spacing.md },
  muted: { color: colors.inkMuted },
  terms: { marginTop: spacing.sm },
  link: { color: colors.primary },
});
