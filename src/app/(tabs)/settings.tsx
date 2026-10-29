import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/data/account';
import { useCabinets } from '@/data/cabinets';
import { askForNotifications, rescheduleDoses } from '@/data/notifications';
import { EXPIRY_NOTICE_DAYS, MISSED_REPEAT_MINUTES, usePrefs } from '@/data/prefs';
import { setMyName } from '@/data/sharing';
import { wipeAll } from '@/data/wipe';
import { LANGUAGES, useI18n, useT, type Language } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Choice, Group, Row } from '@/ui/Rows';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Sheet } from '@/ui/Sheet';
import { Tile } from '@/ui/Tile';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Editing = 'name' | 'language' | 'expiry' | 'missed' | 'wipe' | null;

/** A notification setting changed: ask for notifications if not yet, then lay them out again. */
const renotify = () => void askForNotifications().then(rescheduleDoses);

/**
 * Settings (docs/screens.md): the person's name, the cabinets, the language,
 * notifications, keeping access on a new phone, and deleting everything.
 */
export default function SettingsScreen() {
  const t = useT();
  const cabinets = useCabinets();
  const prefs = usePrefs();
  const account = useAccount();
  const language = useI18n((s) => s.language);
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const version = Constants.expoConfig?.version ?? '';

  const wipe = () => setEditing('wipe');
  const wipeNow = async () => {
    await wipeAll();
    router.dismissAll();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.screenTitle, styles.title]}>{t('settings.title')}</Text>

        <Group title={t('settings.general')}>
          <Row
            icon="user"
            label={t('settings.name')}
            value={prefs.name || t('settings.nameEmpty')}
            onPress={() => setEditing('name')}
          />
          <Row
            icon="first-aid-kit"
            label={t('settings.cabinets')}
            value={cabinets ? String(cabinets.length) : undefined}
            onPress={() => router.push('/cabinets')}
          />
          <Row
            icon="language"
            label={t('settings.language')}
            value={t(`language.${language}`)}
            onPress={() => setEditing('language')}
          />
        </Group>

        <Group title={t('settings.medicines')}>
          <Row
            icon="microscope"
            label={t('settings.markNoEvidence')}
            toggle={{ on: prefs.markNoEvidence === true, onChange: (on) => prefs.set({ markNoEvidence: on }) }}
          />
          <Row
            icon="clock"
            label={t('settings.bodyTime')}
            toggle={{ on: prefs.showBodyTime, onChange: (on) => prefs.set({ showBodyTime: on }) }}
          />
        </Group>

        <Group title={t('settings.notifications')}>
          <Row
            icon="calendar-time"
            label={t('settings.expiry')}
            value={t('cabinet.days', { count: prefs.expiryNoticeDays })}
            onPress={() => setEditing('expiry')}
          />
          <Row
            icon="repeat"
            label={t('settings.missed')}
            value={missedLabel(t, prefs.missedRepeatMinutes)}
            onPress={() => setEditing('missed')}
          />
          <Row
            icon="bell"
            label={t('settings.digest')}
            toggle={{
              on: prefs.weeklyDigest,
              onChange: (on) => {
                prefs.set({ weeklyDigest: on });
                renotify();
              },
            }}
          />
        </Group>

        <Group title={t('settings.newPhone')}>
          <Row
            icon="device-mobile-up"
            label={t('settings.keepAccess')}
            value={account ? t(`signIn.${account}`) : undefined}
            hint={account ? undefined : t('settings.keepAccessHint')}
            onPress={() => router.push('/sign-in')}
          />
        </Group>

        <Group title={t('settings.other')}>
          <Row icon="info" label={t('settings.about')} value={version} />
        </Group>

        <Pressable
          accessibilityRole="button"
          onPress={wipe}
          style={({ pressed }) => [styles.wipe, pressed && styles.pressed]}
        >
          <Icon name="trash" size={22} color={colors.danger} />
          <Text style={[type.cardTitle, styles.danger]}>{t('settings.wipe')}</Text>
        </Pressable>
      </ScrollView>

      {editing === 'name' ? <NameSheet onClose={close} /> : null}
      {editing === 'wipe' ? (
        <ConfirmSheet
          title={t('settings.wipeTitle')}
          text={t('settings.wipeText')}
          confirm={t('settings.wipeYes')}
          onConfirm={() => void wipeNow()}
          onClose={close}
        />
      ) : null}
      {editing === 'language' ? (
        <Sheet onClose={close}>
          <Text style={type.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.choices}>
            {LANGUAGES.map((l: Language) => (
              <Choice
                key={l}
                label={t(`language.${l}`)}
                picked={l === language}
                onPress={() => {
                  useI18n.getState().setLanguage(l);
                  close();
                  // Notifications are written in the language they were laid out in.
                  void rescheduleDoses();
                }}
              />
            ))}
          </View>
        </Sheet>
      ) : null}
      {editing === 'expiry' ? (
        <Sheet onClose={close}>
          <Text style={type.sectionTitle}>{t('settings.expiry')}</Text>
          <Text style={[type.bodyMedium, styles.muted]}>{t('settings.expiryHint')}</Text>
          <View style={styles.tiles}>
            {EXPIRY_NOTICE_DAYS.map((d) => (
              <View key={d} style={styles.fill}>
                <Tile
                  label={String(d)}
                  picked={prefs.expiryNoticeDays === d}
                  height={52}
                  onPress={() => {
                    prefs.set({ expiryNoticeDays: d });
                    close();
                    renotify();
                  }}
                />
              </View>
            ))}
          </View>
        </Sheet>
      ) : null}
      {editing === 'missed' ? (
        <Sheet onClose={close}>
          <Text style={type.sectionTitle}>{t('settings.missed')}</Text>
          <Text style={[type.bodyMedium, styles.muted]}>{t('settings.missedHint')}</Text>
          <View style={styles.choices}>
            {MISSED_REPEAT_MINUTES.map((m) => (
              <Choice
                key={m}
                label={missedLabel(t, m)}
                picked={prefs.missedRepeatMinutes === m}
                onPress={() => {
                  prefs.set({ missedRepeatMinutes: m });
                  close();
                  renotify();
                }}
              />
            ))}
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

function missedLabel(t: ReturnType<typeof useT>, minutes: number): string {
  return minutes === 0 ? t('settings.missedOff') : t('settings.missedValue', { count: minutes });
}

function NameSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(usePrefs.getState().name);
  const save = () => {
    // Offline, the name stays on the phone and goes up with the next invite.
    setMyName(name).catch(() => {});
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <Text style={type.sectionTitle}>{t('settings.name')}</Text>
      <Text style={[type.bodyMedium, styles.muted]}>{t('settings.nameHint')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={40}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={save}
        style={[type.input, styles.input]}
      />
      <Button label={t('common.save')} onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  title: { marginBottom: -spacing.sm },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  choices: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  input: {
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  wipe: {
    marginTop: spacing.xxl,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...cardShadow,
  },
  pressed: { opacity: 0.7 },
  danger: { color: colors.danger, fontSize: 17 },
});
