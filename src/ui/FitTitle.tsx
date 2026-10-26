import type { StyleProp, TextStyle } from 'react-native';

import { FitText } from './FitText';
import { type } from './typography';

/** Smallest size a title shrinks to; below it a word may still break. */
const MIN_SIZE = 18;

/** A screen title that may hold a long medicine name; see FitText. */
export function FitTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <FitText style={[type.screenTitle, style]} minSize={MIN_SIZE} step={2}>
      {children}
    </FitText>
  );
}
