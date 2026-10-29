import { useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackBar } from './BackBar';
import { Button } from './Button';
import { FitTitle } from './FitTitle';
import type { IconName } from './Icon';
import { colors, spacing } from './theme';
import { type } from './typography';
import { useFieldInView } from './useFieldInView';

/**
 * A pushed screen with one job and, mostly, one button at the bottom: ‹ back, the
 * title, a line under it, the content, and the button over the keyboard.
 * The editing screens of a saved medicine; adding has StepScreen instead.
 */
export function FormScreen({
  back,
  title,
  subtitle,
  children,
  button,
  note,
  atEnd,
}: {
  back: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** None where every change is kept as it is made, as on «Деталі». */
  button?: { label: string; onPress: () => void; disabled?: boolean; icon?: IconName };
  /** What the button will do, right above it, so it is read before the tap. */
  note?: ReactNode;
  /** Opened scrolled to the bottom, where the row it was opened for is. */
  atEnd?: boolean;
}) {
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const fieldInView = useFieldInView(scroll);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={back} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scroll}
          {...fieldInView}
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!atEnd || scrolled.current) return;
            scrolled.current = true;
            scroll.current?.scrollToEnd({ animated: false });
          }}
        >
          <FitTitle>{title}</FitTitle>
          {subtitle ? <Text style={[type.bodyMedium, styles.subtitle]}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {button ? (
          <View style={styles.footer}>
            {note}
            <Button label={button.label} icon={button.icon} onPress={button.onPress} disabled={button.disabled} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  subtitle: { color: colors.inkMuted, marginTop: spacing.xs },
  body: { marginTop: spacing.xl },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
});
