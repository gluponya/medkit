import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { NoConnectionError, peekInvite } from '@/data/sharing';
import { useSession } from '@/data/session';
import { CODE_LENGTH, cleanCode, codeFromText } from '@/domain/sharing';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Код запрошення» (docs/screens.md): six cells, three and three, as the code
 * is written in the message. A pasted message gives up its code. The sixth
 * character looks the code up at once; there is no button.
 */
export default function JoinCodeScreen() {
  const t = useT();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [state, setState] = useState<'typing' | 'looking' | 'unknown' | 'offline'>('typing');

  const look = async (full: string) => {
    setState('looking');
    try {
      const peek = await peekInvite(full);
      if (!peek) return setState('unknown');
      setState('typing');
      if (peek.joined) {
        useSession.getState().setCurrentCabinet(peek.cabinetId);
        router.dismissAll();
        router.replace('/home');
      } else if (peek.expired) {
        router.push('/join-expired');
      } else {
        router.push({ pathname: '/join', params: { code: full, peek: JSON.stringify(peek) } });
      }
    } catch (e) {
      setState(e instanceof NoConnectionError ? 'offline' : 'unknown');
    }
  };

  const change = (text: string) => {
    // A whole message pasted in: its code, wherever it stands.
    const next = text.length > CODE_LENGTH ? (codeFromText(text) ?? cleanCode(text)) : cleanCode(text);
    setCode(next);
    setState('typing');
    if (next.length === CODE_LENGTH) void look(next);
  };

  const error = state === 'unknown' ? t('joinCode.unknown') : state === 'offline' ? t('sharing.offline') : null;

  return (
    <FormScreen back={t('common.back')} title={t('joinCode.title')} subtitle={t('joinCode.subtitle')}>
      <Pressable style={styles.cells} onPress={() => input.current?.focus()} accessibilityLabel={t('joinCode.title')}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <View key={i} style={styles.group}>
            {i === 3 ? <View style={styles.gap} /> : null}
            <View style={[styles.cell, i === code.length && state === 'typing' && styles.cellOn, error && styles.cellBad]}>
              <Text style={styles.char}>{code[i] ?? ''}</Text>
            </View>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={change}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        textContentType="oneTimeCode"
        editable={state !== 'looking'}
        style={styles.hidden}
      />
      {state === 'looking' ? <ActivityIndicator style={styles.status} color={colors.primary} /> : null}
      {error ? <Text style={[type.bodyMedium, styles.status, styles.error]}>{error}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', justifyContent: 'center' },
  group: { flexDirection: 'row' },
  gap: { width: spacing.lg },
  cell: {
    width: 46,
    height: 58,
    marginHorizontal: 3,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { borderColor: colors.primary },
  cellBad: { borderColor: colors.danger },
  char: { ...type.screenTitle, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  status: { marginTop: spacing.lg, textAlign: 'center' },
  error: { color: colors.danger },
});
