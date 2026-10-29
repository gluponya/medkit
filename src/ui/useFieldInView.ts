import { useEffect, useRef, type RefObject } from 'react';
import { Keyboard, Platform, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

import { spacing } from './theme';

/**
 * A page that scrolls over a button riding on the keyboard: while the keys
 * are up, the page is scrolled just enough that the field being typed in
 * stands over the button, with air under it. A `KeyboardAvoidingView` only
 * shortens the page; it does not scroll it, and the name under the cabinet
 * on «Приєднатися» stayed half under the button (the owner, 2026-10-26).
 * Freshka's `useFieldOverKeyboard` does the same for its pages.
 *
 * Pass the page's ref and give it `onScroll` and `onLayout`. The page is
 * measured after it has been shortened, so it is tried twice: a moment after
 * the keys are up, and again when the page's frame changes under them.
 */
export function useFieldInView(ref: RefObject<ScrollViewInstance | null>) {
  const offset = useRef(0);

  const lift = () => {
    // A browser scrolls the focused field into view itself, and has no currentlyFocusedInput.
    if (Platform.OS === 'web') return;
    const field = TextInput.State.currentlyFocusedInput();
    const page = ref.current;
    if (!field || !page || !Keyboard.isVisible()) return;
    page.measureInWindow((_x, pageY, _width, pageHeight) => {
      field.measureInWindow((_fx, y, _fw, height) => {
        const over = y + height + spacing.md - (pageY + pageHeight);
        if (over > 0) page.scrollTo({ y: offset.current + over, animated: true });
      });
    });
  };

  useEffect(() => {
    let later: ReturnType<typeof setTimeout> | undefined;
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      later = setTimeout(lift, 50);
    });
    return () => {
      shown.remove();
      clearTimeout(later);
    };
    // `lift` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };

  return { onScroll, onLayout: lift, scrollEventThrottle: 16 };
}
