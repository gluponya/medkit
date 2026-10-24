import { useState } from 'react';
import { StyleSheet, Text, type NativeSyntheticEvent, type StyleProp, type TextLayoutEventData, type TextStyle } from 'react-native';

import { breaksWord } from '@/domain/text';

import { type } from './typography';

/** Smallest size a title shrinks to; below it a word may still break. */
const MIN_SIZE = 18;
const STEP = 2;

/**
 * A screen title that may hold a long medicine name: it wraps between words
 * like any text, and shrinks step by step when a single word does not fit the
 * line, so a word never breaks letter by letter. Hidden until it fits.
 */
export function FitTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const base = StyleSheet.flatten([type.screenTitle, style]);
  const full = base.fontSize ?? 28;
  const ratio = (base.lineHeight ?? full * 1.2) / full;
  // Keyed by the text: a new name starts again from the full size.
  const [fit, setFit] = useState({ text: children, size: full, done: false });
  const state = fit.text === children ? fit : { text: children, size: full, done: false };

  const onTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (state.done) return;
    if (breaksWord(e.nativeEvent.lines) && state.size - STEP >= MIN_SIZE) {
      setFit({ ...state, size: state.size - STEP });
    } else {
      setFit({ ...state, done: true });
    }
  };

  return (
    <Text
      style={[base, { fontSize: state.size, lineHeight: Math.round(state.size * ratio) }, !state.done && styles.hidden]}
      onTextLayout={onTextLayout}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
});
