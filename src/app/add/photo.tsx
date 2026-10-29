import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBoxPhotos } from '@/features/add/boxPhotos';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Side = 'front' | 'flap';

/**
 * «Фото коробки» (docs/screens.md, "Box photo"): two shots, «Крок 1 з 2» the
 * front with the name, «Крок 2 з 2» the flap with the expiry, which can be
 * skipped when no date is printed. The camera's picture fills the screen; the
 * frame is the only clear part, the box's shape for its side.
 */
export default function PhotoScreen() {
  const t = useT();
  const { width } = useWindowDimensions();
  // then=reminder passes on to the adding it leads to, as from the search.
  const { then } = useLocalSearchParams<{ then?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [side, setSide] = useState<Side>('front');
  const [torch, setTorch] = useState(false);
  const [taking, setTaking] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const front = useBoxPhotos((s) => s.front);
  const setShots = useBoxPhotos((s) => s.set);
  const reset = useBoxPhotos((s) => s.reset);

  // A new box starts from nothing: shots of the last one are not this one's.
  useEffect(() => reset(), [reset]);

  const close = () => {
    reset();
    router.back();
  };

  // The camera is done with: back from the reading goes to where the photo was asked for.
  const done = () => router.replace({ pathname: '/add/reading', params: { then } });

  async function ready() {
    const sizes = await camera.current?.getAvailablePictureSizesAsync().catch(() => []);
    setPictureSize(smallestAtLeast(sizes ?? [], MIN_EDGE));
  }

  async function shoot() {
    if (!camera.current || taking) return;
    setTaking(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.6, base64: true, shutterSound: false });
      if (!picture?.base64) return;
      const shot = { uri: picture.uri, base64: picture.base64 };
      if (side === 'front') {
        setShots({ front: shot });
        setSide('flap');
      } else {
        setShots({ flap: shot });
        done();
      }
    } finally {
      setTaking(false);
    }
  }

  const skipFlap = () => {
    setShots({ flap: null });
    done();
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.bar}>
          <Round icon="x" label={t('common.close')} onPress={close} />
        </View>
        <View style={styles.ask}>
          <Icon name="camera" size={40} color={colors.white} />
          <Text style={[type.sectionTitle, styles.light, styles.center]}>{t('photo.askTitle')}</Text>
          <Text style={[type.body, styles.muted, styles.center]}>{t('photo.askText')}</Text>
          <View style={styles.askButton}>
            {/* Refused once, iOS does not ask again: only Settings can turn it on. */}
            {permission.canAskAgain ? (
              <Button label={t('photo.allow')} onPress={() => void requestPermission()} />
            ) : (
              <Button label={t('photo.openSettings')} onPress={() => void Linking.openSettings()} />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const frameWidth = width - 2 * FRAME_INSET;
  const frameHeight = Math.round(frameWidth * (side === 'front' ? 0.64 : 0.34));

  return (
    <View style={styles.screen}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        pictureSize={pictureSize}
        onCameraReady={() => void ready()}
      />

      <SafeAreaView style={styles.dim} edges={['top']}>
        <View style={styles.bar}>
          <Round icon="x" label={t('common.close')} onPress={close} />
          <View style={styles.titles}>
            <Text style={[type.cardTitle, styles.light, styles.center]}>{t('photo.title')}</Text>
            <Text style={[type.label, styles.muted, styles.center]}>
              {t('add.step', { step: side === 'front' ? 1 : 2, total: 2 })}
            </Text>
          </View>
          <Round
            icon={torch ? 'bolt' : 'bolt-off'}
            label={t(torch ? 'photo.torchOff' : 'photo.torchOn')}
            onPress={() => setTorch(!torch)}
            on={torch}
          />
        </View>
      </SafeAreaView>

      <View style={[styles.row, { height: frameHeight }]}>
        <View style={styles.dim} />
        <View style={{ width: frameWidth }}>
          <Corner style={styles.topLeft} />
          <Corner style={styles.topRight} />
          <Corner style={styles.bottomLeft} />
          <Corner style={styles.bottomRight} />
        </View>
        <View style={styles.dim} />
      </View>

      <SafeAreaView style={[styles.dim, styles.bottom]} edges={['bottom']}>
        <View style={styles.hint}>
          <Text style={[type.sectionTitle, styles.light, styles.center]}>
            {t(side === 'front' ? 'photo.frontTitle' : 'photo.flapTitle')}
          </Text>
          <Text style={[type.body, styles.muted, styles.center]}>
            {t(side === 'front' ? 'photo.frontText' : 'photo.flapText')}
          </Text>
        </View>

        <View style={styles.fill} />

        {side === 'flap' ? (
          <Pressable
            accessibilityRole="button"
            onPress={skipFlap}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Icon name="calendar-off" size={20} color={colors.white} />
            <Text style={[type.bodyMedium, styles.light]}>{t('photo.noExpiry')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.side}>
            {side === 'flap' && front ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('photo.retakeFront')}
                onPress={() => setSide('front')}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Image source={{ uri: front.uri }} style={styles.thumb} />
                <View style={styles.taken}>
                  <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
                </View>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.shoot')}
            onPress={() => void shoot()}
            style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
          >
            {taking ? <ActivityIndicator color={colors.white} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.side} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Round({
  icon,
  label,
  onPress,
  on = false,
}: {
  icon: 'x' | 'bolt' | 'bolt-off';
  label: string;
  onPress: () => void;
  on?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.round, on && styles.roundOn, pressed && styles.pressed]}
    >
      <Icon name={icon} size={24} color={on ? colors.night : colors.white} strokeWidth={2} />
    </Pressable>
  );
}

function Corner({ style }: { style: object }) {
  return <View style={[styles.corner, style]} />;
}

/**
 * The smallest of the camera's sizes ("1920x1080") whose long side is at least
 * `edge`, as in Freshka's PhotoCapture: the expiry is small print, but the
 * sensor's twelve megapixels would only be slower to send. None when it names
 * none that way (iOS also offers "Photo" and "High"); the default stands then.
 */
function smallestAtLeast(sizes: string[], edge: number): string | undefined {
  let best: { size: string; area: number } | undefined;
  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match) continue;
    const [w, h] = [Number(match[1]), Number(match[2])];
    if (Math.max(w, h) < edge) continue;
    if (!best || w * h < best.area) best = { size, area: w * h };
  }
  return best?.size;
}

const MIN_EDGE = 1920;
const FRAME_INSET = 36;
const CORNER = 40;
const SHUTTER = 76;
const THUMB = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  fill: { flex: 1 },
  dim: { flex: 1, backgroundColor: colors.nightScrim },
  light: { color: colors.white },
  muted: { color: colors.nightMuted },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  titles: { flex: 1, alignItems: 'center' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
  },
  roundOn: { backgroundColor: colors.white },
  row: { flexDirection: 'row' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  bottom: { paddingBottom: spacing.lg },
  hint: { gap: spacing.xs, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.nightSoft,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
  },
  side: { width: THUMB + 8 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.tile, borderWidth: 2, borderColor: colors.white },
  taken: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER - 16,
    height: SHUTTER - 16,
    borderRadius: (SHUTTER - 16) / 2,
    backgroundColor: colors.white,
  },
  ask: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  askButton: { alignSelf: 'stretch', marginTop: spacing.lg },
});
