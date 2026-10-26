import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useSession } from '@/data/session';
import { joinByCode, type InvitePeek } from '@/data/sharing';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Приєднатися» (docs/screens.md): whose cabinet it is and what is in it, and
 * the name the others will see, prefilled from Settings.
 */
export default function JoinScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ code: string; peek: string }>();
  const peek = JSON.parse(params.peek) as InvitePeek;
  const [name, setName] = useState(usePrefs.getState().name);
  const [state, setState] = useState<'ready' | 'joining' | 'failed'>('ready');

  const join = async () => {
    setState('joining');
    try {
      const id = await joinByCode(params.code, name);
      useSession.getState().setCurrentCabinet(id);
      router.dismissAll();
      router.replace('/home');
    } catch {
      setState('failed');
    }
  };

  return (
    <FormScreen
      back={t('common.back')}
      title={peek.inviter ? t('join.titleFrom', { name: peek.inviter }) : t('join.title')}
      button={{
        label: t('join.button'),
        onPress: () => void join(),
        disabled: name.trim() === '' || state === 'joining',
      }}
      note={state === 'failed' ? <Text style={[type.bodyMedium, styles.error]}>{t('sharing.offline')}</Text> : null}
    >
      <View style={styles.cabinet}>
        <View style={styles.mark}>
          <Icon name={peek.icon} size={28} color={colors.white} />
        </View>
        <View style={styles.fill}>
          <Text style={type.sectionTitle} numberOfLines={1}>
            {peek.name}
          </Text>
          <Text style={type.label}>
            {t('join.contents', {
              medicines: t('cabinets.medicines', { count: peek.medicines }),
              people: t('join.people', { count: peek.people }),
            })}
          </Text>
        </View>
      </View>

      <Text style={[type.cardTitle, styles.label]}>{t('join.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCapitalize="words"
        returnKeyType="done"
        placeholder={t('join.namePlaceholder')}
        placeholderTextColor={colors.inkMuted}
        onSubmitEditing={() => name.trim() !== '' && void join()}
        style={[type.input, styles.input]}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cabinet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.tile,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm },
  input: {
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  error: { color: colors.danger, textAlign: 'center' },
});
