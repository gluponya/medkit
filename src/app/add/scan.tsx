import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { lookupCode } from '@/data/barcodes';
import { useCurrentCabinet } from '@/data/cabinets';
import { undoAdd } from '@/data/medicines';
import { getRegisterEntry } from '@/data/register';
import { useSession } from '@/data/session';
import { OPEN_GATE, passScan, readScan, type Scan } from '@/domain/barcode';
import { displayName } from '@/domain/register';
import { useDraft, type AfterAdd } from '@/features/add/draft';
import { useScan } from '@/features/add/scan';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Hint } from '@/ui/Hint';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';
import { Toast } from '@/ui/Toast';
import { type } from '@/ui/typography';

/** Why the code led nowhere: nobody picked a medicine for it yet, or no network to ask. */
type Miss = 'unknown' | 'offline';

/**
 * Scanner (3-scanner, docs/journeys.md, J2): the camera reads an EAN-13 or a
 * DataMatrix. A known code opens «Додати в «…»» with the medicine, and the
 * expiry when the DataMatrix has it; an unknown one brings up «Ми ще не знаємо
 * цей код» with the box photo and the search. In «Кілька поспіль» each add
 * comes back here with a toast, ready for the next pack.
 */
export default function ScanScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { then } = useLocalSearchParams<{ then?: string }>();
  const after: AfterAdd = then === 'reminder' ? 'reminder' : 'medicine';
  const cabinet = useCurrentCabinet();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [looking, setLooking] = useState(false);
  const [miss, setMiss] = useState<Miss | null>(null);
  // The chip's place on the screen, for the hint: the bottom area's top plus the chip's place in it.
  const [footTop, setFootTop] = useState<number | null>(null);
  const [chip, setChip] = useState<LayoutRectangle | null>(null);
  const many = useScan((s) => s.many);
  const added = useScan((s) => s.added);
  const hintSeen = useSession((s) => s.scanHintSeen);
  const closeHint = useSession((s) => s.closeScanHint);
  const gate = useRef(OPEN_GATE);
  const busy = useRef(false);

  useEffect(() => {
    useScan.getState().set({ open: true });
    return () => useScan.getState().set({ open: false, scan: null, added: null, many: false });
  }, []);

  // Back here, the last pack is done with, and the camera is this screen's
  // again: another camera screen on top has it meanwhile.
  useFocusEffect(
    useCallback(() => {
      useScan.getState().set({ scan: null });
      busy.current = false;
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  function read({ data }: BarcodeScanningResult) {
    const scan = readScan(data);
    if (!scan) return;
    // The gate moves on even while busy, so a pack still held up is not taken for a new one.
    const pass = passScan(gate.current, scan.gtin, now());
    gate.current = pass.gate;
    if (!pass.accept || busy.current) return;
    busy.current = true;
    void find(scan);
  }

  async function find(scan: Scan) {
    useScan.getState().set({ scan, added: null });
    setLooking(true);
    try {
      const answer = await lookupCode(scan.gtin);
      // A code whose entry left the Register is as good as unknown.
      const entry = answer.kind === 'known' ? await getRegisterEntry(answer.registerId) : null;
      if (!entry) {
        setMiss(answer.kind === 'offline' ? 'offline' : 'unknown');
        return;
      }
      const draft = useDraft.getState();
      draft.reset();
      draft.set({
        register: entry,
        name: displayName(entry.name),
        form: entry.form,
        then: after,
        year: scan.expires?.year ?? null,
        month: scan.expires?.month ?? null,
        quantity: answer.kind === 'known' ? answer.packSize : null,
      });
      router.push('/add/confirm');
    } catch (e) {
      console.error('scan lookup failed:', e);
      setMiss('offline');
    } finally {
      setLooking(false);
    }
  }

  const closeMiss = () => {
    setMiss(null);
    useScan.getState().set({ scan: null });
    busy.current = false;
  };

  // The code goes along: what is picked for it there teaches the map.
  const takePhoto = () => {
    setMiss(null);
    router.push({ pathname: '/add/photo', params: { then } });
  };
  const byName = () => {
    setMiss(null);
    router.push({ pathname: '/add/search', params: { then } });
  };

  const undo = () => {
    if (!added) return;
    useScan.getState().set({ added: null });
    void undoAdd(added);
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.bar}>
          <Round icon="x" label={t('common.close')} onPress={() => router.back()} />
        </View>
        <View style={styles.ask}>
          <Icon name="scan" size={40} color={colors.white} />
          <Text style={[type.sectionTitle, styles.light, styles.center]}>{t('photo.askTitle')}</Text>
          <Text style={[type.body, styles.muted, styles.center]}>{t('scan.askText')}</Text>
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
  const frameHeight = Math.round(frameWidth * 0.7);

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused}
        enableTorch={torch && focused}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'datamatrix'] }}
        onBarcodeScanned={miss ? undefined : read}
      />

      <SafeAreaView style={styles.dim} edges={['top']}>
        <View style={styles.bar}>
          <Round icon="x" label={t('common.close')} onPress={() => router.back()} />
          <Text style={[type.cardTitle, styles.light, styles.center, styles.title]} numberOfLines={1}>
            {t('add.addTo', { cabinet: cabinet?.name ?? '' })}
          </Text>
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
        <View style={[styles.frame, { width: frameWidth }]}>
          <Corner style={styles.topLeft} />
          <Corner style={styles.topRight} />
          <Corner style={styles.bottomLeft} />
          <Corner style={styles.bottomRight} />
          <Kinds />
        </View>
        <View style={styles.dim} />
      </View>

      <SafeAreaView
        style={[styles.dim, styles.bottom]}
        edges={['bottom']}
        onLayout={(e) => setFootTop(e.nativeEvent.layout.y)}
      >
        <View style={styles.aim}>
          {looking ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={[type.bodyMedium, styles.light, styles.center]}>{t(looking ? 'scan.looking' : 'scan.aim')}</Text>
        </View>

        <View style={styles.fill} />

        {after === 'medicine' ? (
          <Pressable
            onLayout={(e) => setChip(e.nativeEvent.layout)}
            accessibilityRole="switch"
            accessibilityState={{ checked: many }}
            onPress={() => useScan.getState().set({ many: !many })}
            style={({ pressed }) => [styles.chip, many && styles.chipOn, pressed && styles.pressed]}
          >
            <Icon name="stack" size={20} color={many ? colors.night : colors.white} />
            <Text style={[type.bodyMedium, many ? styles.dark : styles.light]}>
              {t(many ? 'scan.manyOn' : 'scan.manyOff')}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/add/search', params: { then } })}
          style={({ pressed }) => [styles.noCode, pressed && styles.pressed]}
        >
          <Text style={[type.bodyMedium, styles.light, styles.center, styles.underline]}>{t('scan.noCode')}</Text>
        </Pressable>
      </SafeAreaView>

      {added ? (
        <Toast
          key={added.packageId}
          text={t('scan.added', { name: added.name })}
          action={t('common.cancel')}
          onAction={undo}
          onHide={() => useScan.getState().set({ added: null })}
          bottom={insets.bottom + 120}
        />
      ) : null}

      {/* The mode is the one thing on this screen it cannot show by itself (docs/screens.md, "First-time hints"). */}
      {!hintSeen && chip && footTop !== null && !miss && after === 'medicine' ? (
        <Hint
          light
          text={t('scan.manyHint')}
          bottom={height - footTop - chip.y + spacing.sm}
          arrowLeft={chip.x + chip.width / 2 - spacing.lg}
          onClose={closeHint}
        />
      ) : null}

      {miss ? (
        <Sheet onClose={closeMiss}>
          <View style={styles.missIcon}>
            <Icon name={miss === 'offline' ? 'wifi-off' : 'barcode-off'} size={30} color={colors.primary} />
          </View>
          <Text style={type.screenTitle}>{t(miss === 'offline' ? 'scan.offlineTitle' : 'scan.unknownTitle')}</Text>
          <Text style={[type.lead, styles.missText]}>
            {t(miss === 'offline' ? 'scan.offlineText' : 'scan.unknownText')}
          </Text>
          {miss === 'offline' ? (
            <>
              <Button label={t('box.byName')} icon="search" onPress={byName} />
              <Button label={t('scan.again')} icon="scan" variant="secondary" onPress={closeMiss} />
            </>
          ) : (
            <>
              <Button label={t('search.photo')} icon="camera" onPress={takePhoto} />
              <Button label={t('box.byName')} icon="search" variant="secondary" onPress={byName} />
            </>
          )}
        </Sheet>
      ) : null}
    </View>
  );
}

/**
 * What can be scanned, drawn in the frame when the scanner opens: a barcode
 * or a DataMatrix. It fades once read, so the frame is clear for the pack.
 */
function Kinds() {
  const t = useT();
  const [shown] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const fade = Animated.timing(shown, { toValue: 0, delay: 2500, duration: 600, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [shown]);
  return (
    <Animated.View pointerEvents="none" style={[styles.kinds, { opacity: shown }]}>
      <View style={styles.kind}>
        <View style={styles.bars}>
          {BARS.map((w, i) => (
            <View key={i} style={{ width: w * 2, backgroundColor: i % 2 ? 'transparent' : GLYPH }} />
          ))}
        </View>
        <Text style={[type.bodyMedium, styles.glyphText]}>{t('scan.barcode')}</Text>
      </View>
      <Text style={[type.body, styles.glyphText, styles.or]}>{t('scan.or')}</Text>
      <View style={styles.kind}>
        <View style={styles.matrix}>
          {MATRIX.map((row, r) =>
            row.map((on, c) => (on ? <View key={`${r}-${c}`} style={[styles.cell, { top: r * CELL, left: c * CELL }]} /> : null)),
          )}
        </View>
        <Text style={[type.bodyMedium, styles.glyphText]}>DataMatrix</Text>
      </View>
    </Animated.View>
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

/** Outside the component: the clock is read when a code comes, never while drawing. */
const now = () => Date.now();

const FRAME_INSET = 36;
const CORNER = 40;
const GLYPH = '#8A90A0';
/** Bar and gap widths of the drawn barcode, in pairs. */
const BARS = [1, 1, 2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 2];
const CELL = 7;
const SIDE = 11;
/** A DataMatrix's look: the solid L on the left and bottom, the dotted edges, a fixed pattern inside. */
const MATRIX = Array.from({ length: SIDE }, (_, r) =>
  Array.from({ length: SIDE }, (_, c) => {
    if (c === 0 || r === SIDE - 1) return true;
    if (r === 0) return c % 2 === 0;
    if (c === SIDE - 1) return r % 2 === 1;
    return (r * 7 + c * 13 + r * c) % 3 === 0;
  }),
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  fill: { flex: 1 },
  dim: { flex: 1, backgroundColor: colors.nightScrim },
  light: { color: colors.white },
  dark: { color: colors.night },
  muted: { color: colors.nightMuted },
  center: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { flex: 1 },
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
  frame: { justifyContent: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  kinds: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  kind: { alignItems: 'center', gap: spacing.md },
  bars: { flexDirection: 'row', height: CELL * SIDE },
  matrix: { width: CELL * SIDE, height: CELL * SIDE },
  cell: { position: 'absolute', width: CELL, height: CELL, backgroundColor: GLYPH },
  glyphText: { color: colors.nightMuted },
  or: { marginBottom: spacing.xl },
  bottom: { paddingBottom: spacing.lg },
  aim: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.nightSoft,
  },
  chipOn: { backgroundColor: colors.white },
  noCode: { alignSelf: 'center', padding: spacing.sm },
  ask: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  askButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  missIcon: {
    width: 56,
    height: 56,
    marginTop: spacing.md,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  missText: { marginBottom: spacing.sm },
});
