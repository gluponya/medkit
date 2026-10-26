import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteCabinet, updateCabinet, useCabinetCounts, useCabinets, type Cabinet } from '@/data/cabinets';
import { useMembers } from '@/data/sharing';
import { CABINET_ICONS, type CabinetIcon } from '@/domain/places';
import { canEdit, isOwner } from '@/domain/sharing';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon } from '@/ui/Icon';
import { Choice, Group, Row } from '@/ui/Rows';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Sheet } from '@/ui/Sheet';
import { Tile } from '@/ui/Tile';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** «Попереджати про термін»: how many days before the date a medicine turns «expiring». */
const WARNING_DAYS = [7, 14, 30, 60, 90] as const;

type Editing = 'name' | 'icon' | 'warning' | 'delete' | 'leave' | null;

/**
 * Cabinet settings (docs/screens.md): its name, icon and warning days, what it
 * tracks, who has access, and deleting it. Each value opens a sheet of its own.
 * In a shared cabinet a member sees the values without changing them, and
 * leaves it in place of deleting it.
 */
export default function CabinetScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cabinets = useCabinets();
  const counts = useCabinetCounts();
  const [editing, setEditing] = useState<Editing>(null);
  const members = useMembers(id);

  const cabinet = cabinets?.find((c) => c.id === id);
  if (!cabinets || !cabinet) return null;
  const n = counts.get(cabinet.id)?.medicines ?? 0;
  const close = () => setEditing(null);
  const edits = canEdit(cabinet.role);
  const owner = isOwner(cabinet.role);
  const edit = (what: Editing) => (edits ? () => setEditing(what) : undefined);

  const remove = () => setEditing(owner ? 'delete' : 'leave');
  const removeNow = async () => {
    await deleteCabinet(cabinet.id);
    // The last one gone means starting over, from the welcome.
    if (cabinets.length === 1) {
      router.dismissAll();
      router.replace('/');
    } else router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={t('cabinets.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={styles.mark}>
            <Icon name={cabinet.icon} size={32} color={colors.white} />
          </View>
          <View style={styles.fill}>
            <FitTitle>{cabinet.name}</FitTitle>
            <Text style={type.label}>{n === 0 ? t('cabinets.empty') : t('cabinets.medicines', { count: n })}</Text>
          </View>
        </View>

        <Group title={t('cabinet.section')}>
          <Row icon="pencil" label={t('cabinet.name')} value={cabinet.name} onPress={edit('name')} />
          {edits ? <Row icon="shapes" label={t('cabinet.icon')} onPress={edit('icon')} /> : null}
          <Row
            icon="calendar-time"
            label={t('cabinet.warning')}
            value={t('cabinet.days', { count: cabinet.expiryWarningDays })}
            onPress={edit('warning')}
          />
          <Row
            icon="bell"
            label={t('cabinet.expiryPush')}
            toggle={{ on: cabinet.expiryPush, onChange: (on) => updateCabinet(cabinet.id, { expiryPush: on }) }}
          />
        </Group>

        <Group title={t('cabinet.tracks')}>
          <Choice
            label={t('cabinet.expiryOnly')}
            hint={t('cabinet.expiryOnlyHint')}
            picked={cabinet.mode === 'expiry_only'}
            onPress={() => edits && updateCabinet(cabinet.id, { mode: 'expiry_only' })}
          />
          <Choice
            label={t('cabinet.withIntake')}
            hint={t('cabinet.withIntakeHint')}
            picked={cabinet.mode === 'with_intake'}
            onPress={() => edits && updateCabinet(cabinet.id, { mode: 'with_intake' })}
          />
        </Group>

        <Group title={t('cabinet.access')}>
          <Row
            icon="users"
            label={t('cabinet.members')}
            value={String(Math.max(members.length, 1))}
            onPress={() => router.push(`/cabinets/members?id=${cabinet.id}` as Href)}
          />
          {edits ? (
            <Row
              icon="user-plus"
              label={t('cabinet.invite')}
              onPress={() => router.push(`/cabinets/invite?id=${cabinet.id}` as Href)}
            />
          ) : null}
        </Group>

        <Pressable
          accessibilityRole="button"
          onPress={remove}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Icon name={owner ? 'trash' : 'logout'} size={22} color={colors.danger} />
          <Text style={[type.cardTitle, styles.danger]}>{t(owner ? 'cabinet.delete' : 'cabinet.leave')}</Text>
        </Pressable>
      </ScrollView>

      {editing === 'name' ? <NameSheet cabinet={cabinet} onClose={close} /> : null}
      {editing === 'icon' ? <IconSheet cabinet={cabinet} onClose={close} /> : null}
      {editing === 'warning' ? <WarningSheet cabinet={cabinet} onClose={close} /> : null}
      {editing === 'delete' ? (
        <ConfirmSheet
          title={t('cabinet.deleteTitle', { name: cabinet.name })}
          text={t(cabinet.synced ? 'cabinet.deleteTextShared' : 'cabinet.deleteText')}
          confirm={t('cabinet.deleteYes')}
          onConfirm={() => void removeNow()}
          onClose={close}
        />
      ) : null}
      {editing === 'leave' ? (
        <ConfirmSheet
          icon="logout"
          title={t('cabinet.leaveTitle', { name: cabinet.name })}
          text={t('cabinet.leaveText')}
          confirm={t('cabinet.leaveYes')}
          onConfirm={() => void removeNow()}
          onClose={close}
        />
      ) : null}
    </SafeAreaView>
  );
}

function NameSheet({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(cabinet.name);
  const save = async () => {
    await updateCabinet(cabinet.id, { name });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <Text style={type.sectionTitle}>{t('cabinet.name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => name.trim() !== '' && save()}
        style={[type.input, styles.input]}
      />
      <Button label={t('common.save')} onPress={save} disabled={name.trim() === ''} />
    </Sheet>
  );
}

function IconSheet({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const t = useT();
  const pick = async (icon: CabinetIcon) => {
    await updateCabinet(cabinet.id, { icon });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <Text style={type.sectionTitle}>{t('cabinet.icon')}</Text>
      {[CABINET_ICONS.slice(0, 6), CABINET_ICONS.slice(6)].map((row, r) => (
        <View key={r} style={styles.iconRow}>
          {row.map((i) => {
            const on = i === cabinet.icon;
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => pick(i)}
                style={[styles.iconTile, on && styles.iconTileOn]}
              >
                <Icon name={i} size={24} color={on ? colors.white : colors.inkMuted} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Sheet>
  );
}

function WarningSheet({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const t = useT();
  const pick = async (days: number) => {
    await updateCabinet(cabinet.id, { expiryWarningDays: days });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <Text style={type.sectionTitle}>{t('cabinet.warning')}</Text>
      <Text style={[type.bodyMedium, styles.muted]}>{t('cabinet.warningHint')}</Text>
      <View style={styles.days}>
        {WARNING_DAYS.map((d) => (
          <View key={d} style={styles.fill}>
            <Tile label={String(d)} picked={cabinet.expiryWarningDays === d} onPress={() => pick(d)} height={52} />
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delete: {
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
  input: {
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconRow: { flexDirection: 'row', gap: spacing.sm },
  iconTile: {
    flex: 1,
    aspectRatio: 1.15,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  days: { flexDirection: 'row', gap: spacing.sm },
});
