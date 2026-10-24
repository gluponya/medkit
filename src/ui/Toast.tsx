import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from './Icon';
import { motion, useReducedMotion } from './motion';
import { colors, radius, spacing } from './theme';
import { type } from './typography';

/** Long enough to read it and reach «Скасувати». */
const SHOWN_MS = 5000;

/**
 * A dark pill over the bottom of a screen that says what just happened, with
 * one action to take it back. It fades out by itself; `onHide` is called then.
 */
export function Toast({
  text,
  action,
  onAction,
  onHide,
  bottom = spacing.lg,
}: {
  text: string;
  action: string;
  onAction: () => void;
  onHide: () => void;
  bottom?: number;
}) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  // The timer runs once per mount and calls the latest onHide.
  const hide = useRef(onHide);
  useEffect(() => {
    hide.current = onHide;
  });

  useEffect(() => {
    const duration = reduced ? 0 : motion.fade * 2;
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }).start(() => hide.current());
    }, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [opacity, reduced]);

  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, { bottom, opacity }]}>
      <Icon name="circle-check-filled" size={20} color={GREEN} />
      <Text style={[type.cardTitle, styles.text]}>{text}</Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.action} hitSlop={8}>
        <Text style={[type.stepTitle, styles.actionText]}>{action}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Lighter tones of success and primary, readable on the dark pill.
const GREEN = '#7FD3A8';
const BLUE = '#A9BBFF';

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#141C2D',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  text: { flex: 1, color: colors.white },
  action: { height: 40, paddingHorizontal: spacing.md, justifyContent: 'center' },
  actionText: { color: BLUE },
});
