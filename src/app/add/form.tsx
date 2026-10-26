import { router } from 'expo-router';

import { StepScreen } from '@/features/add/StepScreen';
import { useDraft } from '@/features/add/draft';
import { FormTiles } from '@/features/add/FormTiles';
import { useT } from '@/i18n';

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
      <FormTiles form={form} onPick={(f) => set({ form: f })} />
    </StepScreen>
  );
}
