import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

const STEP = 1;

/**
 * FitText for the web build, where Text has no onTextLayout. While it fits,
 * a word is not allowed to break, so a word too long for the line pushes out
 * of the box; that is what is measured, and the text shrinks step by step
 * until nothing does. Hidden until it fits; below `minSize` a word may break.
 */
export function FitText({
  children,
  style,
  minSize,
  step = STEP,
  onFit,
  cap,
}: {
  children: string;
  style: StyleProp<TextStyle>;
  minSize: number;
  step?: number;
  onFit?: (size: number) => void;
  cap?: number;
}) {
  const base = StyleSheet.flatten(style) ?? {};
  const full = base.fontSize ?? 16;
  const ratio = (base.lineHeight ?? full * 1.2) / full;
  const [fit, setFit] = useState({ text: children, size: full, done: false });
  const state = fit.text === children ? fit : { text: children, size: full, done: false };
  const size = state.done && cap !== undefined ? Math.min(state.size, cap) : state.size;
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (state.done || !element) return;
    if (element.scrollWidth > element.clientWidth + 0.5 && state.size - step >= minSize) {
      setFit({ ...state, size: state.size - step });
    } else {
      setFit({ ...state, done: true });
      onFit?.(state.size);
    }
  });

  return (
    <Text
      ref={ref as never}
      style={[base, { fontSize: size, lineHeight: Math.round(size * ratio) }, !state.done && styles.fitting]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  // react-native-web's Text breaks long words by default.
  fitting: { opacity: 0, overflowWrap: 'normal', wordBreak: 'normal' } as TextStyle,
});
