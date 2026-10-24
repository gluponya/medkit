import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCabinet } from '@/data/cabinets';
import { CABINET_ICONS, defaultIcon, defaultMode, PLACES, type CabinetIcon, type Place } from '@/domain/places';
import { useT, type MessageKey } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const PLACE_NAME: Record<Place, MessageKey> = {
  home: 'place.home',
  car: 'place.car',
  dacha: 'place.dacha',
  parents: 'place.parents',
  other: 'place.other',
};

/** Past this much scroll the big title is gone and the bar shows it instead. */
const TITLE_SCROLLED = 64;

/**
 * Where is the cabinet (docs/screens.md): five places as tiles, the picked one
 * opens with its name and icon. Home is picked at first, the most common answer.
 */
export default function PlaceScreen() {
  const t = useT();
  const [place, setPlace] = useState<Place>('home');
  const [name, setName] = useState(t('place.home'));
  const [icon, setIcon] = useState<CabinetIcon>(defaultIcon('home'));
  const [titleInBar, setTitleInBar] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInput = useRef<TextInput>(null);

  const pick = (next: Place) => {
    if (next === place) return;
    setPlace(next);
    setIcon(defaultIcon(next));
    // «Інше» has no name to guess: it starts empty, with the keyboard up.
    setName(next === 'other' ? '' : t(PLACE_NAME[next]));
    if (next === 'other') setTimeout(() => nameInput.current?.focus(), 50);
  };

  const create = async () => {
    setSaving(true);
    try {
      await createCabinet({ name, place, icon });
      router.dismissAll();
      router.replace('/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={[styles.bar, titleInBar && styles.barScrolled]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={24} color={colors.primary} strokeWidth={2} />
          <Text style={[type.cardTitle, styles.backText]}>{t('common.back')}</Text>
        </Pressable>
        {titleInBar ? <Text style={[type.cardTitle, styles.barTitle]}>{t('place.title')}</Text> : null}
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(e) => setTitleInBar(e.nativeEvent.contentOffset.y > TITLE_SCROLLED)}
        >
          <Text style={type.screenTitle}>{t('place.title')}</Text>
          <Text style={[type.bodyMedium, styles.subtitle]}>{t('place.subtitle')}</Text>

          <View style={styles.list}>
            {PLACES.map((p) => {
              const picked = p === place;
              const subtitle = t(defaultMode(p) === 'with_intake' ? 'place.withIntake' : 'place.expiryOnly');
              return (
                <View key={p} style={[styles.tile, picked && styles.tilePicked]}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: picked }}
                    onPress={() => pick(p)}
                    style={styles.tileHead}
                  >
                    <View style={[styles.tileIcon, picked && styles.tileIconPicked]}>
                      <Icon
                        name={picked ? icon : p === 'other' ? 'dots' : defaultIcon(p)}
                        size={24}
                        color={picked ? colors.white : colors.inkMuted}
                      />
                    </View>
                    <View style={styles.fill}>
                      <Text style={[styles.tileName, picked && styles.tileNamePicked]}>{t(PLACE_NAME[p])}</Text>
                      <Text style={[type.bodyMedium, styles.muted]}>{subtitle}</Text>
                    </View>
                    {picked ? <Icon name="circle-check-filled" size={24} color={colors.primary} /> : null}
                  </Pressable>

                  {picked ? (
                    <View style={styles.tileBody}>
                      <Text style={type.label}>{t('place.name')}</Text>
                      <TextInput
                        ref={nameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder={p === 'other' ? t('place.namePlaceholder') : undefined}
                        placeholderTextColor={colors.inkMuted}
                        style={[type.input, styles.input]}
                        maxLength={40}
                        returnKeyType="done"
                      />
                      <Text style={[type.label, styles.iconLabel]}>{t('place.icon')}</Text>
                      {[CABINET_ICONS.slice(0, 6), CABINET_ICONS.slice(6)].map((row, r) => (
                        <View key={r} style={styles.iconRow}>
                          {row.map((i) => {
                            const on = i === icon;
                            return (
                              <Pressable
                                key={i}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                onPress={() => setIcon(i)}
                                style={[styles.iconTile, on && styles.iconTileOn]}
                              >
                                <Icon name={i} size={24} color={on ? colors.white : colors.inkMuted} />
                              </Pressable>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={t('place.create')} onPress={create} disabled={name.trim() === '' || saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  barScrolled: { borderBottomColor: colors.line },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 1 },
  backText: { color: colors.primary, fontSize: 17 },
  barTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  subtitle: { color: colors.inkMuted, marginTop: spacing.xs },
  list: { marginTop: spacing.xl, gap: spacing.sm },
  tile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  tilePicked: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg - 2 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconPicked: { backgroundColor: colors.primary },
  tileName: { ...type.cardTitle, fontSize: 17 },
  tileNamePicked: { color: colors.primary },
  muted: { color: colors.inkMuted },
  tileBody: { paddingHorizontal: spacing.lg - 2, paddingBottom: spacing.lg - 2 },
  input: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  iconLabel: { marginTop: spacing.lg },
  iconRow: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  iconTile: {
    flex: 1,
    aspectRatio: 1.15,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
