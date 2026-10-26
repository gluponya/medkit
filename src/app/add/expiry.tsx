import { router } from 'expo-router';

import { localDay } from '@/domain/expiry';
import { ExpiryPicker, ExpirySummary } from '@/features/add/ExpiryPicker';
import { StepScreen } from '@/features/add/StepScreen';
import { expiryAnswered, useDraft } from '@/features/add/draft';
import { packStep } from '@/features/add/pack';
import { useT } from '@/i18n';

/** Step 3: month and year as on the pack; step 1 of adding another pack. */
export default function ExpiryStep() {
  const t = useT();
  const year = useDraft((s) => s.year);
  const month = useDraft((s) => s.month);
  const ready = useDraft(expiryAnswered);
  const packFor = useDraft((s) => s.packFor);

  return (
    <StepScreen
      {...(packFor ? packStep(1, packFor) : { step: 3 })}
      title={t('add.expiryTitle')}
      subtitle={t('add.expirySubtitle')}
      next={{ label: t('common.next'), onPress: () => router.push('/add/quantity'), disabled: !ready }}
      below={year !== null && month !== null ? <ExpirySummary year={year} month={month} today={localDay(new Date())} /> : null}
    >
      <ExpiryPicker />
    </StepScreen>
  );
}
