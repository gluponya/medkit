import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { colors, radius, spacing } from './theme';
import { type } from './typography';

/**
 * «Видалити …?» as a bottom sheet over the screen it is about, in place of
 * the system alert: a red icon, the question, what goes with it, then the red
 * button and «Скасувати» under it.
 */
export function ConfirmSheet(props: ConfirmProps) {
  return (
    <Sheet onClose={props.onClose}>
      <Confirm {...props} />
    </Sheet>
  );
}

type ConfirmProps = {
  title: string;
  text: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
  icon?: IconName;
};

/** The sheet's content, for a sheet already open (a «⋯» menu turning into the question). */
export function Confirm({
  title,
  text,
  confirm,
  onConfirm,
  onClose,
  icon = 'trash',
}: ConfirmProps) {
  const t = useT();
  return (
    <>
      <View style={styles.icon}>
        <Icon name={icon} size={28} color={colors.danger} />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[type.bodyMedium, styles.text]}>{text}</Text>
      </View>
      <View style={styles.buttons}>
        <Button
          label={confirm}
          variant="danger"
          onPress={() => {
            onClose();
            onConfirm();
          }}
        />
        <Button label={t('common.cancel')} variant="outline" onPress={onClose} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  words: { gap: spacing.xs },
  title: { ...type.sectionTitle, fontSize: 22, lineHeight: 28 },
  text: { color: colors.inkMuted },
  buttons: { gap: spacing.sm, marginTop: spacing.sm },
});
