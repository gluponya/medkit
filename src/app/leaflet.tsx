import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { leafletHtml } from '@/domain/leaflet';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** The archive's bytes as a string, one char per byte, for leafletHtml(). */
function byteString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

/**
 * The instruction from the Register, inside the app. Most are `.mht`, which
 * no phone browser opens, so the page is taken out of it (src/domain/leaflet.ts);
 * a PDF opens as it is. If it does not load, the link can still go to the browser.
 */
export default function LeafletScreen() {
  const t = useT();
  const { url, back } = useLocalSearchParams<{ url: string; back?: string }>();
  const pdf = /\.pdf$/i.test(url);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (pdf) return;
    let live = true;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const page = leafletHtml(byteString(buffer));
        if (!page) throw new Error('no page in the archive');
        if (live) setHtml(page);
      })
      .catch((e: unknown) => {
        console.error('leaflet failed:', e);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [url, pdf]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <BackBar label={back ?? t('common.back')} />
      {failed ? (
        <View style={styles.failed}>
          <Text style={[type.bodyMedium, styles.center]}>{t('leaflet.failed')}</Text>
          <Button label={t('leaflet.browser')} icon="external-link" variant="secondary" onPress={() => void Linking.openURL(url)} />
        </View>
      ) : pdf || html ? (
        <WebView
          style={styles.page}
          originWhitelist={['*']}
          source={pdf ? { uri: url } : { html: html ?? '' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <ActivityIndicator style={styles.waiting} color={colors.primary} size="large" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  page: { flex: 1, backgroundColor: colors.surface },
  waiting: { marginTop: 64 },
  failed: { padding: spacing.xxl, gap: spacing.xl },
  center: { textAlign: 'center' },
});
