import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCabinets } from '@/data/cabinets';
import { sameMedicine, useKnownMedicines, useMedicine, usePackCount } from '@/data/medicines';
import { moveMedicine } from '@/data/move';
import { useReminder } from '@/data/reminders';
import { canEdit } from '@/domain/sharing';
import { reminderWhen } from '@/features/change/text';
import { useT } from '@/i18n';
import { FitText } from '@/ui/FitText';
import { FormScreen } from '@/ui/FormScreen';
import { Icon, type IconName } from '@/ui/Icon';
import { PressScale } from '@/ui/motion';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Куди перенести?» (docs/screens.md): the cabinets as tiles, the one it is in
 * greyed as «Зараз тут». Over the button, what the pick will do: everything goes along;
 * a cabinet with only expiry turns the reminder off; a cabinet that already
 * has this medicine joins them («Об’єднати»). A shared cabinet where one is
 * only a member is not offered: its medicines are not theirs to change.
 */
export default function MoveScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicine = useMedicine(id);
  const cabinets = useCabinets();
  const packs = usePackCount(id);
  const reminder = useReminder(id) ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const known = useKnownMedicines(picked ?? undefined);
  // Only one of the same form joins: tablets never into the syrup, whose numbers are ml.
  const mergePacks = usePackCount(
    picked ? sameMedicine(known, medicine?.registerId ?? '', medicine?.name ?? '', medicine?.form ?? null)?.id : undefined,
  );
  const [saving, setSaving] = useState(false);

  if (!medicine || !cabinets) return null;

  const target = cabinets.find((c) => c.id === picked) ?? null;
  const merge = target ? sameMedicine(known, medicine.registerId ?? '', medicine.name, medicine.form) : null;
  const expiryOnly = target?.mode === 'expiry_only';

  const go = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const into = await moveMedicine({ medicineId: id, cabinetId: target.id, expiryOnly, mergeInto: merge?.id ?? null });
      if (into === id) {
        router.dismissTo({ pathname: '/medicine/[id]', params: { id, moved: target.name } });
        return;
      }
      // Joined: this medicine is gone, so its screen closes too.
      router.dismissTo({ pathname: '/medicine/[id]', params: { id } });
      router.replace({ pathname: '/medicine/[id]', params: { id: into, moved: target.name } });
    } finally {
      setSaving(false);
    }
  };

  let note: { icon: IconName; tone: string; title: string; text: string } | null = null;
  if (target && merge) {
    note = {
      icon: 'arrow-merge',
      tone: colors.primary,
      title: t('move.mergeTitle', { cabinet: target.name, name: merge.name }),
      text: t('move.mergeText', { count: packs + mergePacks }),
    };
  } else if (target && expiryOnly && reminder) {
    note = {
      icon: 'bell-off',
      tone: colors.inkMuted,
      title: t('move.reminderOff'),
      text: t('move.reminderOffText', { cabinet: target.name, when: reminderWhen(t, reminder) }),
    };
  } else if (target) {
    note = { icon: 'circle-check', tone: colors.success, title: t('move.allGoes'), text: t('move.allGoesText') };
  }

  return (
    <FormScreen
      back={t('details.title')}
      title={t('move.title')}
      subtitle={packs > 0 ? `${medicine.name}, ${t('move.packs', { count: packs })}` : medicine.name}
      note={
        note ? (
          <View style={styles.note}>
            <Icon name={note.icon} size={24} color={note.tone} />
            <View style={styles.fill}>
              <Text style={type.cardTitle}>{note.title}</Text>
              <Text style={[type.label, styles.muted]}>{note.text}</Text>
            </View>
          </View>
        ) : undefined
      }
      button={{
        label: merge ? t('change.merge') : t('move.move'),
        onPress: () => void go(),
        disabled: !target || saving,
      }}
    >
      <View style={styles.list}>
        {cabinets
          .filter((c) => c.id === medicine.cabinetId || canEdit(c.role))
          .map((c) => {
          const here = c.id === medicine.cabinetId;
          const on = c.id === picked;
          const line = here ? t('move.here') : c.mode === 'expiry_only' ? t('place.expiryOnly') : t('place.withIntake');
          return (
            <PressScale
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: here }}
              disabled={here}
              onPress={() => setPicked(c.id)}
              style={[styles.tile, on && styles.tileOn, here && styles.tileHere]}
            >
              <View style={[styles.mark, on && styles.markOn]}>
                <Icon name={c.icon} size={24} color={on ? colors.primary : colors.inkMuted} />
              </View>
              <View style={styles.fill}>
                <FitText style={[type.cardTitle, on && styles.primary]} minSize={12}>
                  {c.name}
                </FitText>
                <Text style={[type.secondary, styles.muted]}>{line}</Text>
              </View>
              {on ? <Icon name="circle-check-filled" size={24} color={colors.primary} /> : null}
            </PressScale>
          );
        })}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  primary: { color: colors.primary },
  list: { gap: spacing.sm },
  tile: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tileOn: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.lg - 1 },
  tileHere: { backgroundColor: colors.surfaceSoft, opacity: 0.6 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: colors.surface },
  note: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
  },
});
