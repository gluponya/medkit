import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useSession } from '@/data/session';
import { isInviteGone, joinByCode, NoConnectionError, peekInvite, type InvitePeek } from '@/data/sharing';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** The peek join-code passed along; undefined when there is none to read (a link with the code alone). */
function readPeek(raw: string | undefined): InvitePeek | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as InvitePeek;
  } catch {
    return undefined;
  }
}

function openCabinet(id: string) {
  useSession.getState().setCurrentCabinet(id);
  router.dismissAll();
  router.replace('/home');
}

/**
 * «Приєднатися» (docs/screens.md): whose cabinet it is and what is in it, and
 * the name the others will see, prefilled from Settings. Opened with the code
 * alone, it looks the invite up itself; offline, it still lets the person join.
 */
export default function JoinScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ code?: string; peek?: string }>();
  const code = params.code ?? '';
  const [peek, setPeek] = useState<InvitePeek | undefined>(() => readPeek(params.peek));
  const [name, setName] = useState(usePrefs.getState().name);
  const [state, setState] = useState<'ready' | 'joining' | 'offline' | 'failed'>('ready');

  useEffect(() => {
    if (peek) return;
    if (!code) {
      router.replace('/join-code');
      return;
    }
    let live = true;
    peekInvite(code).then(
      (found) => {
        if (!live) return;
        if (!found) router.replace('/join-code');
        else if (found.joined && found.cabinetId) openCabinet(found.cabinetId);
        else if (found.expired) router.replace('/join-expired');
        else setPeek(found);
      },
      (e: unknown) => {
        if (live) setState(e instanceof NoConnectionError ? 'offline' : 'failed');
      },
    );
    return () => {
      live = false;
    };
  }, [code, peek]);

  const join = async () => {
    setState('joining');
    try {
      openCabinet(await joinByCode(code, name));
    } catch (e) {
      // Unknown, expired, or its cabinet deleted: the server cannot say which.
      if (isInviteGone(e)) router.replace('/join-expired');
      else setState(e instanceof NoConnectionError ? 'offline' : 'failed');
    }
  };

  const note =
    state === 'offline' ? t('sharing.offline') : state === 'failed' ? t('common.saveFailed') : null;

  return (
    <FormScreen
      back={t('common.back')}
      title={peek?.inviter ? t('join.titleFrom', { name: peek.inviter }) : t('join.title')}
      button={{
        label: t('join.button'),
        onPress: () => void join(),
        disabled: name.trim() === '' || code === '' || state === 'joining',
      }}
      note={note ? <Text style={[type.bodyMedium, styles.error]}>{note}</Text> : null}
    >
      {peek ? (
        <View style={styles.cabinet}>
          <View style={styles.mark}>
            <Icon name={peek.icon ?? 'first-aid-kit'} size={28} color={colors.white} />
          </View>
          <View style={styles.fill}>
            <Text style={type.sectionTitle} numberOfLines={1}>
              {peek.name ?? ''}
            </Text>
            <Text style={type.label}>
              {t('join.contents', {
                medicines: t('cabinets.medicines', { count: peek.medicines ?? 0 }),
                people: t('join.people', { count: peek.people ?? 0 }),
              })}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={[type.cardTitle, styles.label]}>{t('join.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCapitalize="words"
        returnKeyType="done"
        placeholder={t('join.namePlaceholder')}
        placeholderTextColor={colors.inkMuted}
        onSubmitEditing={() => name.trim() !== '' && code !== '' && void join()}
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
