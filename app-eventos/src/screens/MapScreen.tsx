import { useState } from 'react';
import {
  Modal,
  Platform,
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
import NotificationCenter from '../components/NotificationCenter';
import {
  MAP_MOCK_STANDS,
  MAP_MOCK_ACCESS_LOGS,
  MAP_MOCK_ZONES,
} from '../domain/map/mapMockData';
import { calculateZoneOccupancy } from '../domain/map/calculateZoneOccupancy';
import { useMapData } from '../hooks/useMapData';
import { useEventNotifications } from '../providers/NotificationProvider';

const MAP_MOCK_ZONE_OCCUPANCIES = MAP_MOCK_ZONES.map((zone) =>
  calculateZoneOccupancy(zone, MAP_MOCK_ACCESS_LOGS),
);

export default function MapScreen() {
  const { snapshot, loading, error, isOffline, refresh } = useMapData();
  const {
    notifications,
    unreadCount,
    permissionState,
    isOnline,
    canSimulate,
    error: notificationError,
    requestPermission,
    openSettings,
    markRead,
    markAllRead,
    simulateNotification,
  } = useEventNotifications();
  const [panning, setPanning] = useState(false);
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [permissionRationaleVisible, setPermissionRationaleVisible] = useState(false);
  const hasMapData = Boolean(snapshot && (snapshot.stands.length > 0 || snapshot.zones.length > 0));
  const showMockData = __DEV__ && !loading && !error && !hasMapData;
  const occupancyDataSource: OccupancyDataSource = showMockData ? 'demo' : 'cache';
  const lastUpdatedAt = snapshot?.last_synced_at ?? null;
  const mapStands = showMockData ? MAP_MOCK_STANDS : (snapshot?.stands ?? []);
  const mapZones = showMockData
    ? MAP_MOCK_ZONE_OCCUPANCIES
    : (snapshot?.zones ?? []);
  const notificationZones = mapZones.map((occupancy) => occupancy.zone);
  const timestampLabel = getOccupancyFreshnessLabel(occupancyDataSource, lastUpdatedAt);

  const continuePermissionRequest = () => {
    setPermissionRationaleVisible(false);
    void requestPermission();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!panning}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR WAY / RECINTO</Text>
            <Text style={styles.title}>Mapa y aforo</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir centro de avisos. ${unreadCount} sin leer`}
              onPress={() => setNotificationCenterVisible(true)}
              style={styles.bellButton}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <View style={[styles.networkBadge, isOffline && styles.offlineBadge]}>
              <View style={[styles.networkDot, isOffline && styles.offlineDot]} />
              <Text style={[styles.networkLabel, isOffline && styles.offlineLabel]}>
                {isOffline ? 'Sin conexión' : showMockData ? 'Datos de ejemplo' : 'Datos en caché'}
              </Text>
            </View>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotificationCenterVisible(true)}
              style={styles.viewNotificationsButton}
            >
              <Text style={styles.viewNotificationsText}>
                Ver avisos{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.permissionHint}>
            Los avisos ya recibidos quedan guardados y se pueden consultar sin conexión.
            {!isOnline ? ' No se reciben ni simulan avisos nuevos en modo offline.' : ''}
          </Text>

          {permissionState === 'granted' ? (
            <Text style={styles.permissionEnabled}>Notificaciones del sistema activas.</Text>
          ) : permissionState === 'denied' ? (
            <View>
              <Text style={styles.warningText}>
                Las notificaciones del sistema están desactivadas. Los avisos in-app y el historial
                siguen disponibles.
              </Text>
              <View style={styles.permissionActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPermissionRationaleVisible(true)}
                  style={styles.enableButton}
                >
                  <Text style={styles.enableButtonText}>Reintentar</Text>
                </Pressable>
                {Platform.OS !== 'web' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void openSettings()}
                    style={styles.settingsButton}
                  >
                    <Text style={styles.settingsButtonText}>Abrir ajustes</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : permissionState === 'unavailable' ? (
            <Text style={styles.warningText}>
              Las notificaciones del sistema no están disponibles en esta plataforma; los avisos
              in-app siguen funcionando.
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPermissionRationaleVisible(true)}
              style={styles.enableButton}
            >
              <Text style={styles.enableButtonText}>Activar avisos del sistema</Text>
            </Pressable>
          )}
          {notificationError ? <Text style={styles.warningText}>{notificationError}</Text> : null}
        </View>

        <Text style={styles.dataNote}>
          La base de datos actual no incluye la geometría de salas ni el servicio backend de avisos.
          Las zonas se muestran como marcadores sin geometría de contorno.
        </Text>
      </ScrollView>

      <NotificationCenter
        visible={notificationCenterVisible}
        notifications={notifications}
        zones={notificationZones}
        unreadCount={unreadCount}
        isOnline={isOnline}
        canSimulate={canSimulate}
        permissionState={permissionState}
        error={notificationError}
        onClose={() => setNotificationCenterVisible(false)}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onSimulate={simulateNotification}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setPermissionRationaleVisible(false)}
        transparent
        visible={permissionRationaleVisible}
      >
        <View style={styles.rationaleBackdrop}>
          <View style={styles.rationaleCard}>
            <Text style={styles.rationaleTitle}>¿Para qué sirven los avisos?</Text>
            <Text style={styles.rationaleText}>
              Te informan de comunicaciones de la organización, cambios de horario y alertas de
              aforo. El permiso permite mostrar notificaciones del sistema cuando la app está en
              segundo plano. Los avisos in-app y el historial seguirán disponibles si lo deniegas.
            </Text>
            <View style={styles.rationaleActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPermissionRationaleVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Ahora no</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={continuePermissionRequest}
                style={styles.enableButton}
              >
                <Text style={styles.enableButtonText}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { color: '#56736D', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#173A35', fontSize: 25, fontWeight: '700', marginTop: 4 },
  bellButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3EBE7',
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 42,
  },
  bellIcon: { fontSize: 17 },
  unreadBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#C94F43',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2EFEB',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  offlineBadge: { backgroundColor: '#FFF0D7' },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#167B71', marginRight: 5 },
  offlineDot: { backgroundColor: '#C78219' },
  networkLabel: { color: '#25635A', fontSize: 10, fontWeight: '600' },
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
  viewNotificationsButton: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#E2EFEB',
  },
  viewNotificationsText: { color: '#167B71', fontSize: 11, fontWeight: '700' },
  permissionEnabled: { color: '#167B71', fontSize: 11, fontWeight: '700', marginTop: 8 },
  permissionHint: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 9 },
  warningText: { color: '#8B5C13', fontSize: 11, lineHeight: 16, marginTop: 8 },
  permissionActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  enableButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#167B71',
  },
  enableButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  settingsButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    borderColor: '#CBD8D2',
    borderWidth: 1,
  },
  settingsButtonText: { color: '#526B63', fontSize: 11, fontWeight: '700' },
  dataNote: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 13 },
  rationaleBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 35, 31, 0.5)',
    padding: 22,
  },
  rationaleCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18 },
  rationaleTitle: { color: '#173A35', fontSize: 18, fontWeight: '700' },
  rationaleText: { color: '#526B63', fontSize: 13, lineHeight: 20, marginTop: 9 },
  rationaleActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 18 },
  cancelButton: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  cancelButtonText: { color: '#526B63', fontSize: 11, fontWeight: '700' },
});
