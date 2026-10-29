import { useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextLayoutEvent, type TextStyle } from 'react-native';

import { breaksWord } from '@/domain/text';

const STEP = 1;

/**
 * Text that may hold a long word in a narrow box (a medicine or category
 * name in a tile): it wraps between words like any text, and shrinks step by
 * step when a single word does not fit the line, so a word never breaks
 * letter by letter. Hidden until it fits. `minSize` is the floor; below it a
 * word may still break. `onFit` gets the size it settled on, and `cap` keeps
 * it at most that, so a set of texts can all take the smallest one.
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
  /** Never larger than this; smaller never breaks a word, so it needs no new fitting. */
  cap?: number;
}) {
  const base = StyleSheet.flatten(style) ?? {};
  const full = base.fontSize ?? 16;
  const ratio = (base.lineHeight ?? full * 1.2) / full;
  // Keyed by the text: a new text starts again from the full size.
  const [fit, setFit] = useState({ text: children, size: full, done: false });
  const state = fit.text === children ? fit : { text: children, size: full, done: false };
  const size = state.done && cap !== undefined ? Math.min(state.size, cap) : state.size;

  const onTextLayout = (e: TextLayoutEvent) => {
    if (state.done) return;
    if (breaksWord(e.nativeEvent.lines) && state.size - step >= minSize) {
      setFit({ ...state, size: state.size - step });
    } else {
      setFit({ ...state, done: true });
      onFit?.(state.size);
    }
  };

  return (
    <Text
      style={[base, { fontSize: size, lineHeight: Math.round(size * ratio) }, !state.done && styles.hidden]}
      onTextLayout={onTextLayout}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
});
