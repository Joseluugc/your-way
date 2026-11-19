import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventMapCanvas, {
  getOccupancyFreshnessLabel,
  type OccupancyDataSource,
} from '../components/EventMapCanvas';
import {
  MAP_MOCK_STANDS,
  MAP_MOCK_ACCESS_LOGS,
  MAP_MOCK_ZONES,
} from '../domain/map/mapMockData';
import { calculateZoneOccupancy } from '../domain/map/calculateZoneOccupancy';
import { useMapData } from '../hooks/useMapData';
import { useEventNotifications } from '../providers/NotificationProvider';
import type { OrganizationAlertType } from '../domain/notifications/organizationAlert';

const MAP_MOCK_ZONE_OCCUPANCIES = MAP_MOCK_ZONES.map((zone) =>
  calculateZoneOccupancy(zone, MAP_MOCK_ACCESS_LOGS),
);

export default function MapScreen() {
  const { snapshot, loading, error, isOffline, refresh } = useMapData();
  const {
    alerts,
    permissionState,
    error: notificationError,
    requestPermission,
  } = useEventNotifications();
  const [panning, setPanning] = useState(false);
  const hasMapData = Boolean(snapshot && (snapshot.stands.length > 0 || snapshot.zones.length > 0));
  const showMockData = __DEV__ && !loading && !error && !hasMapData;
  const occupancyDataSource: OccupancyDataSource = showMockData ? 'demo' : 'cache';
  const lastUpdatedAt = snapshot?.last_synced_at ?? null;
  const mapStands = showMockData ? MAP_MOCK_STANDS : (snapshot?.stands ?? []);
  const mapZones = showMockData
    ? MAP_MOCK_ZONE_OCCUPANCIES
    : (snapshot?.zones ?? []);
  const timestampLabel = getOccupancyFreshnessLabel(occupancyDataSource, lastUpdatedAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!panning}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR WAY / RECINTO</Text>
            <Text style={styles.title}>Mapa y aforo</Text>
          </View>
          <View style={[styles.networkBadge, isOffline && styles.offlineBadge]}>
            <View style={[styles.networkDot, isOffline && styles.offlineDot]} />
            <Text style={[styles.networkLabel, isOffline && styles.offlineLabel]}>
            {isOffline ? 'Sin conexión' : showMockData ? 'Datos de ejemplo' : 'Datos en caché'}
            </Text>
          </View>
        </View>

        <Text style={styles.syncLabel}>
          {timestampLabel}
          {isOffline ? ' · último dato conocido, no es en tiempo real' : ''}
        </Text>

        <EventMapCanvas
          stands={mapStands}
          zones={mapZones}
          occupancyDataSource={occupancyDataSource}
          lastUpdatedAt={lastUpdatedAt}
          loading={loading && !snapshot}
          demoData={showMockData}
          onPanningChange={setPanning}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationCopy}>
              <Text style={styles.sectionTitle}>Avisos del evento</Text>
              <Text style={styles.sectionSubtitle}>
                Organización, cambios de horario y alertas de aforo.
              </Text>
            </View>
            {permissionState !== 'granted' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void requestPermission()}
                style={styles.enableButton}
              >
                <Text style={styles.enableButtonText}>Activar avisos</Text>
              </Pressable>
            ) : (
              <Text style={styles.permissionEnabled}>Permiso activo</Text>
            )}
          </View>
          <Text style={styles.permissionHint}>
            Solo se solicitará permiso al activar. Si lo deniegas, los avisos guardados seguirán
            disponibles en esta pantalla.
          </Text>
          {permissionState === 'denied' ? (
            <Text style={styles.warningText}>
              Las notificaciones del sistema están desactivadas; los avisos in-app siguen disponibles.
            </Text>
          ) : null}
          {permissionState === 'unavailable' ? (
            <Text style={styles.warningText}>
              Las notificaciones del sistema no están disponibles en esta plataforma.
            </Text>
          ) : null}
          {notificationError ? <Text style={styles.warningText}>{notificationError}</Text> : null}
          {alerts.length > 0 ? (
            <View style={styles.alertList}>
              {alerts.slice(0, 5).map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <Text style={styles.alertType}>{alertTypeLabel(alert.type)}</Text>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <Text style={styles.alertDate}>{formatDate(alert.created_at)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.mutedText}>Todavía no se han recibido avisos.</Text>
          )}
        </View>

        <Text style={styles.dataNote}>
          La base de datos actual no incluye la geometría de salas ni el servicio backend de avisos.
          Las zonas se muestran como marcadores sin geometría de contorno.
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
}

function alertTypeLabel(type: OrganizationAlertType): string {
  switch (type) {
    case 'ORGANIZATION':
      return 'ORGANIZACIÓN';
    case 'SCHEDULE_CHANGE':
      return 'CAMBIO DE HORARIO';
    case 'CAPACITY_OPEN':
      return 'AFORO ABIERTO';
    case 'CAPACITY_CLOSE':
      return 'AFORO CERRADO';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-ES');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6F4' },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 70,
  },
  eyebrow: { color: '#56736D', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#173A35', fontSize: 25, fontWeight: '700', marginTop: 4 },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2EFEB',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offlineBadge: { backgroundColor: '#FFF0D7' },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#167B71', marginRight: 6 },
  offlineDot: { backgroundColor: '#C78219' },
  networkLabel: { color: '#25635A', fontSize: 11, fontWeight: '600' },
  offlineLabel: { color: '#825510' },
  syncLabel: { color: '#71827D', fontSize: 11, marginTop: 4, marginBottom: 16 },
  sectionTitle: { color: '#173A35', fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: '#71827D', fontSize: 11, marginTop: 3 },
  errorCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#C94F43',
    backgroundColor: '#FCEBE7',
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: '#7D322B', fontSize: 12 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8 },
  retryText: { color: '#913C32', fontSize: 12, fontWeight: '700' },
  mutedText: { color: '#6E817C', fontSize: 12, marginTop: 8 },
  notificationCard: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3EBE7',
    marginTop: 4,
  },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notificationCopy: { flex: 1 },
  enableButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#167B71',
  },
  enableButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  permissionEnabled: { color: '#167B71', fontSize: 10, fontWeight: '700' },
  permissionHint: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 9 },
  warningText: { color: '#8B5C13', fontSize: 11, lineHeight: 16, marginTop: 8 },
  alertList: { marginTop: 11 },
  alertItem: { borderTopWidth: 1, borderTopColor: '#E7EEEA', paddingVertical: 10 },
  alertType: { color: '#167B71', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  alertTitle: { color: '#243E39', fontSize: 13, fontWeight: '700', marginTop: 3 },
  alertMessage: { color: '#526B63', fontSize: 11, lineHeight: 16, marginTop: 3 },
  alertDate: { color: '#87958F', fontSize: 9, marginTop: 4 },
  dataNote: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 13 },
});
