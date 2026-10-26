import { router, useLocalSearchParams } from 'expo-router';

import { StepScreen } from '@/features/add/StepScreen';
import { FormTiles } from '@/features/add/FormTiles';
import { cancelChange, useChange } from '@/features/change/draft';
import { useT } from '@/i18n';

/** «Змінити ліки» by hand, step 2 of 2: the form. Then the comparison (J9). */
export default function ChangeFormStep() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = useChange((s) => s.name);
  const form = useChange((s) => s.form);
  const set = useChange((s) => s.set);

  const next = () => {
    if (form === null) return;
    set({ target: { name: name.trim(), form, register: null } });
    router.push({ pathname: '/medicine/[id]/change', params: { id } });
  };

  return (
    <StepScreen
      step={2}
      total={2}
      onCancel={cancelChange}
      title={t('add.formTitle')}
      subtitle={name.trim()}
      next={{ label: t('common.next'), onPress: next, disabled: form === null }}
    >
      <FormTiles form={form} onPick={(f) => set({ form: f })} />
    </StepScreen>
  );
}
