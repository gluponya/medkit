import { StyleSheet, View } from 'react-native';

import { colors } from './theme';

/**
 * The look of an on/off switch: blue when on, as every picked thing is. Drawn
 * by the app, not the system switch, which iOS paints green. It is only a
 * picture; the row it stands in is what is pressed (Row in Rows.tsx).
 */
export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.track, on && styles.on]}>
      <View style={[styles.thumb, on && styles.thumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: colors.line,
  },
  on: { backgroundColor: colors.primary },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbOn: { alignSelf: 'flex-end' },
});
