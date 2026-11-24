import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NfcScanRecord, ScanOutcome } from '../domain/nfc/scanTag';
import type { TagResolution } from '../domain/nfc/nfcTag';
import { useNfcPoc } from '../hooks/useNfcPoc';

const COLORS = {
  primary: '#167B71',
  text: '#1D2B28',
  muted: '#71827D',
  border: '#D6E0DD',
  surface: '#FFFFFF',
  background: '#F4F7F6',
  success: '#1E7B3A',
  warning: '#9A5B00',
  danger: '#B3261E',
};

function describeResolution(resolution: TagResolution): string {
  switch (resolution.kind) {
    case 'USER_WRISTBAND':
      return `Pulsera de asistente · usuario ${resolution.userId}`;
    case 'STAND_POINT':
      return `Punto NFC de estand · ${resolution.standId}`;
    case 'ZONE_CHECKPOINT':
      return `Control de zona · ${resolution.zoneId}`;
    case 'UNKNOWN':
      return 'Tag no reconocido: no está en nfc_tags';
    case 'INCONSISTENT':
      return 'Tag registrado con datos incompletos';
  }
}

function describeFailure(outcome: Extract<ScanOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case 'CANCELLED':
      return 'Lectura cancelada.';
    case 'TIMEOUT':
      return 'No se ha detectado ningún tag en 30 s. Vuelve a intentarlo.';
    case 'UNSUPPORTED':
      return 'Este dispositivo no puede leer NFC.';
    case 'UNREADABLE':
      return 'Se ha leído un tag, pero sin UID válido ni registro de Your Way.';
    case 'FAILED':
      return 'No se ha podido leer, vuelve a acercarlo.';
  }
}

function ScanDetails({ record }: { record: NfcScanRecord }) {
  return (
    <View style={styles.details}>
      <Text style={styles.detailLine}>UID: {record.uid ?? '—'} ({record.uidSource ?? 'sin UID'})</Text>
      <Text style={styles.detailLine}>Tecnologías: {record.techTypes.join(', ') || '—'}</Text>
      <Text style={styles.detailLine}>NDEF: {record.ndefTexts.join(' | ') || '—'}</Text>
      <Text style={styles.detailLine}>Resolución local: {record.durationMs} ms</Text>
    </View>
  );
}

export default function NfcPocScreen() {
  const nfc = useNfcPoc();
  const outcome = nfc.lastOutcome;
  const unknownUid =
    outcome?.ok && outcome.resolution.kind === 'UNKNOWN' ? outcome.resolution.uid : null;
  const canScan = nfc.availability === 'READY' && !nfc.scanning;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Prueba de concepto NFC</Text>
        <Text style={styles.subtitle}>
          Lee un tag físico y lo resuelve contra la base de datos local, sin usar la red.
        </Text>

        <View style={styles.card} accessibilityRole="summary">
          <Text style={styles.cardTitle}>Estado del lector</Text>
          {nfc.availability === 'CHECKING' && <Text style={styles.body}>Comprobando…</Text>}
          {nfc.availability === 'READY' && (
            <Text style={[styles.body, { color: COLORS.success }]}>NFC listo</Text>
          )}
          {nfc.availability === 'DISABLED' && (
            <>
              <Text style={[styles.body, { color: COLORS.warning }]}>
                El NFC está desactivado.
              </Text>
              {Platform.OS === 'android' && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => void nfc.openSettings()}
                >
                  <Text style={styles.secondaryButtonText}>Abrir ajustes de NFC</Text>
                </Pressable>
              )}
            </>
          )}
          {nfc.availability === 'UNSUPPORTED' && (
            <Text style={[styles.body, { color: COLORS.danger }]}>
              NFC no disponible. Usa un dispositivo físico con un development build (no
              funciona en Expo Go, emuladores ni web).
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canScan }}
          disabled={!canScan}
          style={[styles.primaryButton, !canScan && styles.buttonDisabled]}
          onPress={() => void nfc.scan()}
        >
          <Text style={styles.primaryButtonText}>
            {nfc.scanning ? 'Acerca el tag…' : 'Escanear tag'}
          </Text>
        </Pressable>
        {nfc.scanning && Platform.OS === 'android' && (
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => void nfc.cancel()}
          >
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
        )}

        {outcome && (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <Text style={styles.cardTitle}>Última lectura</Text>
            <Text style={styles.body}>
              {outcome.ok ? describeResolution(outcome.resolution) : describeFailure(outcome)}
            </Text>
            {'record' in outcome && <ScanDetails record={outcome.record} />}
          </View>
        )}

        {unknownUid && nfc.usersWithoutWristband.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vincular como pulsera de prueba</Text>
            <Text style={styles.caption}>
              Solo para la prueba: guarda el UID en nfc_tags. La vinculación real es la US-02.3.
            </Text>
            {nfc.usersWithoutWristband.map((user) => (
              <Pressable
                key={user.id}
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => void nfc.linkTestWristband(unknownUid, user.id)}
              >
                <Text style={styles.secondaryButtonText}>{user.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {nfc.error && <Text style={[styles.body, { color: COLORS.danger }]}>{nfc.error}</Text>}

        <Text style={styles.sectionTitle}>Lecturas guardadas en SQLite</Text>
        {nfc.history.length === 0 ? (
          <Text style={styles.caption}>Todavía no hay lecturas.</Text>
        ) : (
          nfc.history.map((record) => (
            <View key={record.id} style={styles.historyItem}>
              <Text style={styles.historyTitle}>
                {record.resolution} · {record.uid ?? 'sin UID'}
              </Text>
              <Text style={styles.caption}>
                {new Date(record.scannedAt).toLocaleString('es-ES')} · {record.durationMs} ms
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 15, color: COLORS.muted },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 8 },
  body: { fontSize: 15, color: COLORS.text },
  caption: { fontSize: 13, color: COLORS.muted },
  details: { gap: 4 },
  detailLine: { fontSize: 13, color: COLORS.text, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  buttonDisabled: { opacity: 0.4 },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  historyItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 2,
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});
