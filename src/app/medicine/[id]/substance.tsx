import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { registerBrands, searchRegister } from '@/data/register';
import { closeBrands, singleInn } from '@/domain/register';
import { useMedicineEdit } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Choice, Group } from '@/ui/Rows';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** The substances of the medicines found, each once, the best first. */
async function innsOf(text: string, limit: number): Promise<string[]> {
  const found = await searchRegister(text, limit);
  return [...new Set(found.map((e) => singleInn(e.inn)).filter((inn): inn is string => inn !== null))];
}

/**
 * The substances for what was typed. Nothing found is most often a typo
 * («эсцитолопрам»): then the substances of the names it is close to, as the
 * search of adding does.
 */
async function substances(text: string): Promise<{ list: string[]; close: boolean }> {
  const list = (await innsOf(text, 60)).slice(0, 8);
  if (list.length > 0) return { list, close: false };
  const near = closeBrands(text, await registerBrands());
  const close = (await Promise.all(near.map((brand) => innsOf(brand, 20)))).flat();
  return { list: [...new Set(close)].slice(0, 4), close: true };
}

/**
 * The active substance of «Деталі», picked from the State Register: typing
 * finds substances by their name or by a medicine's («нурофен» finds
 * Ibuprofen), so only a real one can be saved. With nothing picked and the
 * field empty, «Готово» clears it.
 */
export default function SubstanceScreen() {
  const t = useT();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => fields?.inn.trim() ?? '');
  const [result, setResult] = useState<{ query: string; list: string[]; close: boolean } | null>(null);
  const searching = query.trim().length >= 2;
  // The list found for what is typed now; none while it is being looked up.
  const found = searching && result?.query === query ? result.list : null;
  const close = found !== null && result?.close === true;

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const timer = setTimeout(() => {
      void substances(query).then((r) => live && setResult({ query, ...r }));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, searching]);

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields) return null;

  // Before a search, the saved substance is the one row, picked.
  const rows = found ?? (searching ? [] : picked ? [picked] : []);
  const ready = picked !== '' || query.trim() === '';
  const done = () => {
    if (!ready) return;
    set({ inn: picked });
    router.back();
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t('details.inn')}
      subtitle={t('details.innHint')}
      button={{ label: t('common.done'), onPress: done, disabled: !ready }}
    >
      <TextInput
        autoFocus
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPicked('');
        }}
        placeholder={t('details.innSearch')}
        placeholderTextColor={colors.inkMuted}
        autoCorrect={false}
        style={[type.input, styles.input]}
        returnKeyType="search"
      />
      {rows.length > 0 ? (
        <Group title={close ? t('details.innClose') : undefined}>
          {rows.map((inn) => (
            <Choice key={inn} label={inn} picked={inn === picked} onPress={() => setPicked(inn)} />
          ))}
        </Group>
      ) : found ? (
        <View style={styles.none}>
          <Text style={[type.bodyMedium, styles.noneText]}>{t('details.innNone')}</Text>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 58,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
  },
  none: { marginTop: spacing.xl },
  noneText: { color: colors.inkMuted },
});
