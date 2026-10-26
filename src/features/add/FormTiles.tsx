import { StyleSheet, Text, View } from 'react-native';

import { isOtherForm, MAIN_FORMS, OTHER_FORMS, type MedicineForm } from '@/domain/medicine';
import { useT } from '@/i18n';
import { Tile } from '@/ui/Tile';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

import { FORM_NAME } from './labels';

/**
 * The form tiles of adding, «Деталі» and changing a medicine: the main forms
 * in two columns. Picking «Інше» opens the Register's other forms under them
 * («Розчин», «Супозиторії»…); one of those keeps «Інше» picked as well. Plain
 * «Інше» is an answer of its own.
 */
export function FormTiles({ form, onPick }: { form: MedicineForm | null; onPick: (form: MedicineForm) => void }) {
  const t = useT();
  const open = form === 'other' || isOtherForm(form);

  return (
    <>
      <View style={styles.grid}>
        {MAIN_FORMS.map((f) => (
          <View key={f} style={styles.cell}>
            <Tile
              label={t(FORM_NAME[f])}
              picked={f === form || (f === 'other' && open)}
              onPress={() => onPick(f)}
            />
          </View>
        ))}
      </View>
      {open ? (
        <>
          <Text style={[type.label, styles.caption]}>{t('form.otherWhich')}</Text>
          <View style={styles.grid}>
            {OTHER_FORMS.map((f) => (
              <View key={f} style={styles.cell}>
                <Tile label={t(FORM_NAME[f])} picked={f === form} onPress={() => onPick(f)} height={52} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1 },
  caption: { marginTop: spacing.xl, marginBottom: spacing.md, color: colors.inkMuted },
});
