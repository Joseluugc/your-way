import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NfcFeedback, NfcReadResult } from '../domain/nfc/nfcFeedback';

interface NfcResultBannerProps {
  feedback: NfcFeedback | null;
  onDismiss?: () => void;
}

/** Colores con contraste WCAG AA (texto ≥ 4,5:1 sobre su fondo). */
const TONE: Record<NfcReadResult, { background: string; border: string; text: string }> = {
  SUCCESS: { background: '#E7F4EC', border: '#23804F', text: '#17532F' },
  ACCESS_DENIED: { background: '#FBE9E7', border: '#C0392B', text: '#7D2318' },
  READ_ERROR: { background: '#FDF1E2', border: '#A85F08', text: '#6B3D06' },
};

/**
 * Aviso visible del resultado de una lectura NFC. Es una región "viva": Android la lee al
 * cambiar (`accessibilityLiveRegion`) y en iOS la anuncia `useNfcFeedback`.
 */
export default function NfcResultBanner({ feedback, onDismiss }: NfcResultBannerProps) {
  if (!feedback) return null;
  const tone = TONE[feedback.result];

  return (
    <View
      style={[styles.banner, { backgroundColor: tone.background, borderColor: tone.border }]}
      testID={`nfc-result-${feedback.result}`}
    >
      {/* Región anunciada: icono y texto. El botón de cerrar queda fuera para que el
          lector de pantalla lo pueda enfocar por separado. */}
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={feedback.announcement}
        accessibilityLiveRegion="assertive"
        style={styles.content}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.icon, { color: tone.text }]}
        >
          {feedback.icon}
        </Text>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: tone.text }]}>{feedback.title}</Text>
          <Text style={[styles.message, { color: tone.text }]}>{feedback.message}</Text>
        </View>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso de lectura"
          onPress={onDismiss}
          style={styles.close}
        >
          <Text style={[styles.closeText, { color: tone.text }]}>Cerrar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 26, fontWeight: '800', width: 28, textAlign: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 14, marginTop: 2 },
  close: { paddingVertical: 6, paddingHorizontal: 8 },
  closeText: { fontSize: 14, fontWeight: '700' },
});
