import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';

import { Icon } from './Icon';
import { motion, useReducedMotion } from './motion';
import { colors, radius, spacing } from './theme';
import { type } from './typography';

/**
 * A first-time hint (docs/screens.md): a dark bubble with an arrow pointing up
 * at what it explains, and a quiet ×. It lies over the whole area it is put
 * in, so a tap anywhere closes it. `top` is where the arrow's tip goes and
 * `arrowLeft` how far from the left edge it points. With `bottom` instead
 * the bubble stands above what it explains, the arrow pointing down; `light`
 * makes it white, for a dark screen such as the scanner.
 */
export function Hint({
  text,
  top,
  bottom,
  arrowLeft,
  light = false,
  onClose,
}: {
  text: string;
  arrowLeft: number;
  onClose: () => void;
  light?: boolean;
} & ({ top: number; bottom?: never } | { bottom: number; top?: never })) {
  const t = useT();
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: reduced ? 0 : motion.fade * 2, useNativeDriver: true }).start();
  }, [shown, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text}. ${t('common.close')}`}
      onPress={onClose}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        style={[styles.wrap, bottom === undefined ? { top } : [styles.wrapUp, { bottom }], { opacity: shown }]}
      >
        <View
          style={[
            styles.arrow,
            bottom === undefined ? styles.arrowUp : styles.arrowDown,
            light && styles.light,
            { left: arrowLeft - ARROW / 2 },
          ]}
        />
        <View style={[styles.bubble, light && styles.light]}>
          <Text style={[type.cardTitle, styles.text, light && styles.lightText]}>{text}</Text>
          <Icon name="x" size={20} color={colors.inkMuted} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** The arrow is a square turned on its corner, half of it showing. */
const ARROW = 14;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: 72, paddingTop: ARROW / 2 },
  // Above what it explains: clear of the screen's sides on both.
  wrapUp: { right: spacing.lg, paddingTop: 0, paddingBottom: ARROW / 2 },
  arrowUp: { top: 2 },
  arrowDown: { bottom: 2 },
  light: { backgroundColor: colors.white },
  lightText: { color: colors.ink },
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    borderRadius: 2,
    backgroundColor: colors.ink,
    transform: [{ rotate: '45deg' }],
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, color: colors.white, fontSize: 17, lineHeight: 24 },
});
