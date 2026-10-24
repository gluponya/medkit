import { router } from 'expo-router';
import { StyleSheet, TextInput } from 'react-native';

import { StepScreen } from '@/features/add/StepScreen';
import { useDraft } from '@/features/add/draft';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** Step 1: the name, as on the box. «Далі» waits for a name. */
export default function NameStep() {
  const t = useT();
  const name = useDraft((s) => s.name);
  const set = useDraft((s) => s.set);
  const ready = name.trim() !== '';
  const next = () => {
    if (ready) router.push('/add/form');
  };

  return (
    <StepScreen
      step={1}
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
