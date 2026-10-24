import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MEDICINE_FORMS } from '@/domain/medicine';
import { StepScreen } from '@/features/add/StepScreen';
import { useDraft } from '@/features/add/draft';
import { FORM_NAME } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Tile } from '@/ui/Tile';
import { spacing } from '@/ui/theme';

/** Step 2: the form, two columns of tiles. It sets the unit of step 4. */
export default function FormStep() {
  const t = useT();
  const name = useDraft((s) => s.name);
  const form = useDraft((s) => s.form);
  const set = useDraft((s) => s.set);

  return (
    <StepScreen
      step={2}
      title={t('add.formTitle')}
      subtitle={name.trim()}
      next={{ label: t('common.next'), onPress: () => router.push('/add/expiry'), disabled: form === null }}
    >
      <View style={styles.grid}>
        {MEDICINE_FORMS.map((f) => (
          <View key={f} style={styles.cell}>
            <Tile label={t(FORM_NAME[f])} picked={f === form} onPress={() => set({ form: f })} />
          </View>
        ))}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1 },
});
