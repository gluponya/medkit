import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { readBox, type BoxReply } from '@/data/box';
import { useBoxPhotos } from '@/features/add/boxPhotos';
import { useT, type MessageKey } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Failure = Exclude<BoxReply['kind'], 'read'>;

const FAILURE: Record<Failure, { title: MessageKey; text: MessageKey }> = {
  offline: { title: 'reading.offlineTitle', text: 'reading.offlineText' },
  limit: { title: 'reading.limitTitle', text: 'reading.limitText' },
  failed: { title: 'reading.failedTitle', text: 'reading.failedText' },
  'not-a-box': { title: 'reading.notABoxTitle', text: 'reading.notABoxText' },
};

/**
 * «Читаємо коробку…» (13-photo-3-reading): the two shots go to recognise-box,
 * and a line runs over them while it reads. Read, it gives way to «Це ці
 * ліки?»; when it could not, it says why and offers another photo or the
 * search by name.
 */
export default function ReadingScreen() {
  const t = useT();
  const { then } = useLocalSearchParams<{ then?: string }>();
  const front = useBoxPhotos((s) => s.front);
  const flap = useBoxPhotos((s) => s.flap);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!front) return;
    let live = true;
    void readBox(front.base64, flap?.base64 ?? null).then((reply) => {
      if (!live) return;
      if (reply.kind !== 'read') {
        setFailure(reply.kind);
        return;
      }
      useBoxPhotos.getState().set({ reading: reply.reading });
      router.replace({ pathname: '/add/box', params: { then } });
    });
    return () => {
      live = false;
    };
  }, [front, flap, then, attempt]);

  const close = () => {
    useBoxPhotos.getState().reset();
    router.back();
  };
  const again = () => router.replace({ pathname: '/add/photo', params: { then } });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={close}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <Icon name="x" size={24} color={colors.white} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.middle}>
        <View style={styles.shots}>
          {front ? <Image source={{ uri: front.uri }} style={[styles.shot, styles.frontShot]} /> : null}
          {flap ? <Image source={{ uri: flap.uri }} style={[styles.shot, styles.flapShot]} /> : null}
          {failure ? null : <ScanLine />}
        </View>

        {failure ? (
          <>
            <Text style={[type.sectionTitle, styles.light, styles.center]}>{t(FAILURE[failure].title)}</Text>
            <Text style={[type.body, styles.muted, styles.center]}>{t(FAILURE[failure].text)}</Text>
          </>
        ) : (
          <>
            <Text style={[type.sectionTitle, styles.light, styles.center]}>{t('reading.title')}</Text>
            <Text style={[type.body, styles.muted, styles.center]}>{t('reading.text')}</Text>
          </>
        )}
      </View>

      {failure ? (
        <View style={styles.buttons}>
          {failure === 'offline' ? (
            <Button label={t('reading.retry')} onPress={() => {
                setFailure(null);
                setAttempt(attempt + 1);
              }} />
          ) : failure === 'limit' ? null : (
            <Button label={t('reading.again')} icon="camera" onPress={again} />
          )}
          <Button label={t('reading.byName')} icon="search" variant="secondary" onPress={close} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** The line that runs up and down over the shots while they are read. */
function ScanLine() {
  const [run] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(run, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(run, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [run]);
  const translateY = run.interpolate({ inputRange: [0, 1], outputRange: [0, SHOTS_HEIGHT] });
  return <Animated.View pointerEvents="none" style={[styles.line, { transform: [{ translateY }] }]} />;
}

const SHOTS_HEIGHT = 300;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  light: { color: colors.white },
  muted: { color: colors.nightMuted },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  bar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
  },
  middle: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl },
  shots: { height: SHOTS_HEIGHT, marginBottom: spacing.xxl },
  shot: { position: 'absolute', borderRadius: radius.tile, borderWidth: 2, borderColor: colors.white },
  frontShot: { left: '8%', top: 0, width: '68%', height: 190, transform: [{ rotate: '-5deg' }] },
  flapShot: { right: '4%', bottom: 0, width: '58%', height: 110, transform: [{ rotate: '4deg' }] },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    boxShadow: `0 0 12px ${colors.primary}`,
  },
  buttons: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
