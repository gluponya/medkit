import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput } from 'react-native';

import { StepScreen } from '@/features/add/StepScreen';
import { cancelChange, useChange } from '@/features/change/draft';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** «Змінити ліки» by hand, step 1 of 2: the name, as on the box (J9). */
export default function ChangeNameStep() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = useChange((s) => s.name);
  const set = useChange((s) => s.set);
  const ready = name.trim() !== '';
  const next = () => {
    if (ready) router.push({ pathname: '/medicine/[id]/change-form', params: { id } });
  };

  return (
    <StepScreen
      step={1}
      total={2}
      onCancel={cancelChange}
      title={t('add.nameTitle')}
      subtitle={t('add.nameSubtitle')}
      next={{ label: t('common.next'), onPress: next, disabled: !ready }}
    >
      <TextInput
        autoFocus
        value={name}
        onChangeText={(value) => set({ name: value })}
        placeholder={t('add.namePlaceholder')}
        placeholderTextColor={colors.inkMuted}
        style={[type.input, styles.input]}
        maxLength={80}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={next}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 58,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
  },
});
