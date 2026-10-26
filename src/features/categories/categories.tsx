import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { useCustomCategories } from '@/data/categories';
import { CATEGORIES, type Category } from '@/domain/categories';
import { CATEGORY_ICON, CATEGORY_NAME } from '@/features/add/labels';
import { useT } from '@/i18n';
import type { IconName } from '@/ui/Icon';
import { Tile } from '@/ui/Tile';
import { spacing } from '@/ui/theme';

/** The twelve icons an own category can have (docs/screens.md, "Own category"). */
export const OWN_ICONS = [
  'tag',
  'bandage',
  'baby-bottle',
  'dental',
  'bone',
  'lungs',
  'brain',
  'paw',
  'run',
  'bed',
  'sun',
  'star',
] as const satisfies readonly IconName[];

export const ownIcon = (icon: string): IconName =>
  (OWN_ICONS as readonly string[]).includes(icon) ? (icon as IconName) : 'tag';

const isBuiltIn = (key: string): key is Category => (CATEGORIES as readonly string[]).includes(key);

/** A tag's name: a built-in category in the current language, or an own one as typed. */
export function useCategoryName(): (key: string) => string {
  const t = useT();
  const own = useCustomCategories();
  return (key) => (isBuiltIn(key) ? t(CATEGORY_NAME[key]) : (own.find((c) => c.id === key)?.name ?? ''));
}

/**
 * The picks of the Categories screen opened from a saved medicine, kept
 * outside it so «Своя категорія» can come back with the new one picked.
 */
export const useCategoryPicks = create<{ picked: string[]; set: (picked: string[]) => void }>()((set) => ({
  picked: [],
  set: (picked) => set({ picked }),
}));

/** Who gets the category «Своя категорія» makes: the add draft or the Categories screen. */
export type OwnCategoryFor = 'draft' | 'picks';

export const openOwnCategory = (target: OwnCategoryFor) =>
  router.push({ pathname: '/category-new', params: { for: target } });

/**
 * Two columns of category tiles, several can be picked: the built-in ones,
 * the person's own ones, and the dashed «Своя категорія».
 */
export function CategoryGrid({
  picked,
  onToggle,
  onOwn,
}: {
  picked: readonly string[];
  onToggle: (key: string) => void;
  onOwn: () => void;
}) {
  const t = useT();
  const own = useCustomCategories();
  const tiles = [
    ...CATEGORIES.map((c) => ({ key: c as string, label: t(CATEGORY_NAME[c]), icon: CATEGORY_ICON[c] })),
    ...own.map((c) => ({ key: c.id, label: c.name, icon: ownIcon(c.icon) })),
  ];

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View key={tile.key} style={styles.cell}>
          <Tile
            label={tile.label}
            icon={tile.icon}
            picked={picked.includes(tile.key)}
            check
            role="checkbox"
            onPress={() => onToggle(tile.key)}
            height={60}
          />
        </View>
      ))}
      <View style={styles.cell}>
        <Tile label={t('add.ownCategory')} icon="plus" dashed role="button" onPress={onOwn} height={60} />
      </View>
    </View>
  );
}

/** One more or one less in a set of picks. */
export const toggled = (picked: readonly string[], key: string): string[] =>
  picked.includes(key) ? picked.filter((c) => c !== key) : [...picked, key];

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1 },
});
