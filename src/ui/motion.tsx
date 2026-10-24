import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The app's motion: short, soft and without bounce. Every animation takes its
 * timing from here, so the whole app moves the same way.
 */
export const motion = {
  /** A press: the element settles a little under the finger. */
  press: { speed: 80, bounciness: 0 },
  /** The release: back to size, a touch slower than the press. */
  release: { speed: 50, bounciness: 0 },
  /** Cross-fades, such as between tabs. */
  fade: 120,
} as const;

/** Whether the person asked the system to reduce motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/**
 * A Pressable that shrinks a little while held and eases back when let go.
 * `outerStyle` is for layout around it (flex, margins); `style` is the
 * Pressable's own, as usual. With reduced motion it only dims.
 */
export function PressScale({
  scaleTo = 0.97,
  outerStyle,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, 'children'> & { scaleTo?: number; outerStyle?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const animate = (pressed: boolean) => {
    const spring = pressed ? motion.press : motion.release;
    if (reduced) {
      Animated.timing(opacity, { toValue: pressed ? 0.7 : 1, duration: 80, useNativeDriver: true }).start();
      return;
    }
    Animated.spring(scale, { toValue: pressed ? scaleTo : 1, ...spring, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[outerStyle, { opacity, transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={(e) => {
          animate(true);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animate(false);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
