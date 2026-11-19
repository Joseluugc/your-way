import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import EventMapCanvas, {
  getOccupancyFreshnessLabel,
} from '../components/EventMapCanvas';
import { MapRepository } from '../database/MapRepository';
import { createOrUpdateStand } from '../domain/map/manageStand';
import type { Stand, UserRole } from '../domain/map/mapTypes';
import NotificationCenter from '../components/NotificationCenter';
import { useMapData } from '../hooks/useMapData';
import { useEventNotifications } from '../providers/NotificationProvider';

interface StandDraft {
  id?: string;
  name: string;
  ownerId: string;
  map_x: number | null;
  map_y: number | null;
}

export default function MapScreen() {
  const database = useSQLiteContext();
  const {
    snapshot,
    events,
    activeEventId,
    setActiveEventId,
    loading,
    error,
    syncError,
    syncStatus,
    isOffline,
    refresh,
  } = useMapData();
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
  const [activeRole, setActiveRole] = useState<UserRole>('ATTENDEE');
  const [standDraft, setStandDraft] = useState<StandDraft | null>(null);
  const [placingStandLocation, setPlacingStandLocation] = useState(false);
  const [standFormError, setStandFormError] = useState<string | null>(null);
  const [savingStand, setSavingStand] = useState(false);
  const lastUpdatedAt = snapshot?.last_synced_at ?? null;
  const mapStands = snapshot?.stands ?? [];
  const mapZones = snapshot?.zones ?? [];
  const notificationZones = mapZones.map((occupancy) => occupancy.zone);
  const timestampLabel = getOccupancyFreshnessLabel('cache', lastUpdatedAt);

  const continuePermissionRequest = () => {
    setPermissionRationaleVisible(false);
    void requestPermission();
  };

  const startNewStand = () => {
    setStandFormError(null);
    setStandDraft({ name: '', ownerId: '', map_x: null, map_y: null });
    setPlacingStandLocation(false);
  };

  const startEditingStand = (stand: Stand) => {
    setStandFormError(null);
    setStandDraft({
      id: stand.id,
      name: stand.name,
      ownerId: stand.owner_id ?? '',
      map_x: stand.map_x,
      map_y: stand.map_y,
    });
    setPlacingStandLocation(false);
  };

  const saveStand = async () => {
    if (!standDraft || !activeEventId) {
      setStandFormError('Selecciona un evento antes de guardar el estand.');
      return;
    }

    setSavingStand(true);
    setStandFormError(null);
    try {
      await createOrUpdateStand(
        activeRole,
        {
          id: standDraft.id,
          name: standDraft.name,
          owner_id: standDraft.ownerId.trim() || null,
          map_x: standDraft.map_x ?? Number.NaN,
          map_y: standDraft.map_y ?? Number.NaN,
          evento_id: activeEventId,
        },
        new MapRepository(database),
      );
      setStandDraft(null);
      setPlacingStandLocation(false);
      refresh();
    } catch (saveError: unknown) {
      setStandFormError(
        saveError instanceof Error ? saveError.message : 'No se pudo guardar el estand.',
      );
    } finally {
      setSavingStand(false);
    }
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
                {isOffline
                  ? 'Sin conexión'
                  : syncStatus === 'syncing'
                    ? 'Sincronizando'
                    : 'Conectado'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>Evento activo</Text>
          <ScrollView
            horizontal
            contentContainerStyle={styles.selectorOptions}
            showsHorizontalScrollIndicator={false}
          >
            {events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityState={{ selected: activeEventId === event.id }}
                onPress={() => setActiveEventId(event.id)}
                style={[
                  styles.selectorOption,
                  activeEventId === event.id && styles.selectedSelectorOption,
                ]}
              >
                <Text
                  style={[
                    styles.selectorOptionText,
                    activeEventId === event.id && styles.selectedSelectorOptionText,
                  ]}
                >
                  {event.titulo}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.roleRow}>
            <Text style={styles.selectorLabel}>Rol temporal</Text>
            <View style={styles.roleOptions}>
              {(['ATTENDEE', 'STAFF'] as const).map((role) => (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeRole === role }}
                  onPress={() => {
                    setActiveRole(role);
                    if (role !== 'STAFF') {
                      setStandDraft(null);
                      setPlacingStandLocation(false);
                    }
                  }}
                  style={[styles.roleOption, activeRole === role && styles.selectedRoleOption]}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      activeRole === role && styles.selectedSelectorOptionText,
                    ]}
                  >
                    {role === 'STAFF' ? 'STAFF · gestionar' : 'ATTENDEE'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {activeRole === 'STAFF' ? (
            <Pressable
              accessibilityRole="button"
              disabled={!activeEventId}
              onPress={startNewStand}
              style={[styles.addStandButton, !activeEventId && styles.disabledSyncButton]}
            >
              <Text style={styles.addStandButtonText}>＋ Añadir estand</Text>
            </Pressable>
          ) : (
            <Text style={styles.roleHint}>
              El selector es temporal para la demo; la autorización real debe venir de la sesión del servidor.
            </Text>
          )}
        </View>

        {standDraft ? (
          <View style={styles.standForm}>
            <Text style={styles.standFormTitle}>
              {standDraft.id ? 'Editar estand' : 'Nuevo estand'}
            </Text>
            <TextInput
              accessibilityLabel="Nombre del estand"
              maxLength={100}
              onChangeText={(name) => setStandDraft((draft) => draft ? { ...draft, name } : draft)}
              placeholder="Nombre del estand"
              style={styles.standInput}
              value={standDraft.name}
            />
            <TextInput
              accessibilityLabel="UUID del propietario, opcional"
              autoCapitalize="none"
              onChangeText={(ownerId) =>
                setStandDraft((draft) => draft ? { ...draft, ownerId } : draft)
              }
              placeholder="UUID de owner_id (opcional)"
              style={styles.standInput}
              value={standDraft.ownerId}
            />
            <Text style={styles.coordinateLabel}>
              Ubicación:{' '}
              {standDraft.map_x === null || standDraft.map_y === null
                ? 'sin seleccionar'
                : `${standDraft.map_x.toFixed(2)}, ${standDraft.map_y.toFixed(2)}`}
            </Text>
            <View style={styles.standFormActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPlacingStandLocation((placing) => !placing)}
                style={[
                  styles.locationButton,
                  placingStandLocation && styles.locationButtonActive,
                ]}
              >
                <Text style={styles.locationButtonText}>
                  {placingStandLocation ? 'Toca el plano…' : 'Elegir ubicación en el plano'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingStand}
                onPress={() => void saveStand()}
                style={[styles.saveStandButton, savingStand && styles.disabledSyncButton]}
              >
                <Text style={styles.saveStandText}>
                  {savingStand ? 'Guardando…' : 'Guardar'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStandDraft(null);
                  setPlacingStandLocation(false);
                  setStandFormError(null);
                }}
                style={styles.cancelStandButton}
              >
                <Text style={styles.cancelStandText}>Cancelar</Text>
              </Pressable>
            </View>
            {standFormError ? <Text style={styles.standFormError}>{standFormError}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.syncLabel}>
          {timestampLabel}
          {isOffline ? ' · último dato conocido, no es tiempo real' : ' · actualización puntual, no tiempo real'}
        </Text>

        <EventMapCanvas
          stands={mapStands}
          zones={mapZones}
          occupancyDataSource="cache"
          lastUpdatedAt={lastUpdatedAt}
          loading={loading}
          onPanningChange={setPanning}
          managementMode={activeRole === 'STAFF'}
          placingStandLocation={placingStandLocation}
          previewCoordinates={
            standDraft?.map_x !== null && standDraft?.map_x !== undefined &&
            standDraft.map_y !== null
              ? { map_x: standDraft.map_x, map_y: standDraft.map_y }
              : null
          }
          onMapCoordinateSelect={(coordinates) => {
            setStandDraft((draft) =>
              draft ? { ...draft, map_x: coordinates.map_x, map_y: coordinates.map_y } : draft,
            );
            setPlacingStandLocation(false);
          }}
          onEditStand={startEditingStand}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: syncStatus === 'syncing' }}
          disabled={syncStatus === 'syncing'}
          onPress={refresh}
          style={[
            styles.syncButton,
            syncStatus === 'syncing' && styles.disabledSyncButton,
          ]}
        >
          <Text style={styles.syncButtonText}>
            {syncStatus === 'syncing' ? 'Sincronizando mapa y aforo…' : 'Sincronizar ahora'}
          </Text>
        </Pressable>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}
        {syncError ? (
          <View style={styles.syncErrorCard}>
            <Text style={styles.syncErrorText}>{syncError}</Text>
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
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E3EBE7',
    padding: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  selectorLabel: { color: '#526B63', fontSize: 10, fontWeight: '700' },
  selectorOptions: { gap: 7, paddingVertical: 8 },
  selectorOption: {
    borderColor: '#DCE6E1',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedSelectorOption: { backgroundColor: '#E2EFEB', borderColor: '#167B71' },
  selectorOptionText: { color: '#526B63', fontSize: 11, fontWeight: '600' },
  selectedSelectorOptionText: { color: '#167B71', fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  roleOptions: { flexDirection: 'row', gap: 6 },
  roleOption: { borderWidth: 1, borderColor: '#DCE6E1', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  selectedRoleOption: { backgroundColor: '#E2EFEB', borderColor: '#167B71' },
  roleOptionText: { color: '#526B63', fontSize: 10, fontWeight: '600' },
  addStandButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#167B71',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  addStandButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  roleHint: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 8 },
  standForm: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9D8D1',
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    marginBottom: 12,
  },
  standFormTitle: { color: '#173A35', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  standInput: {
    color: '#243E39',
    backgroundColor: '#FBFDFC',
    borderColor: '#DCE6E1',
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 12,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  coordinateLabel: { color: '#526B63', fontSize: 11, marginTop: 9 },
  standFormActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 10 },
  locationButton: {
    backgroundColor: '#FFF0D7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  locationButtonActive: { backgroundColor: '#E89A2C' },
  locationButtonText: { color: '#704B11', fontSize: 10, fontWeight: '700' },
  saveStandButton: { backgroundColor: '#167B71', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  saveStandText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cancelStandButton: { paddingHorizontal: 8, paddingVertical: 9 },
  cancelStandText: { color: '#526B63', fontSize: 10, fontWeight: '700' },
  standFormError: { color: '#913C32', fontSize: 11, lineHeight: 16, marginTop: 8 },
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
  syncButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#167B71',
    borderRadius: 9,
    marginBottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  disabledSyncButton: { backgroundColor: '#91A7A0' },
  syncButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
  syncErrorCard: {
    backgroundColor: '#FFF0D7',
    borderLeftColor: '#C78219',
    borderLeftWidth: 3,
    marginTop: 8,
    padding: 11,
  },
  syncErrorText: { color: '#825510', fontSize: 11, lineHeight: 16 },
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
