import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  filterAndSortEventNotifications,
  getRelatedZoneName,
  type EventNotification,
  type EventNotificationFilter,
  type EventNotificationType,
} from '../domain/notifications/eventNotification';
import type { Zone } from '../domain/map/mapTypes';
import type { NotificationPermissionState } from '../providers/NotificationProvider';

interface NotificationCenterProps {
  visible: boolean;
  notifications: readonly EventNotification[];
  zones: readonly Zone[];
  unreadCount: number;
  isOnline: boolean;
  canSimulate: boolean;
  permissionState: NotificationPermissionState;
  error: string | null;
  onClose: () => void;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSimulate: (type: EventNotificationType, relatedZoneId?: string | null) => Promise<boolean>;
}

const FILTERS: { value: EventNotificationFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ORGANIZATION_NOTICE', label: 'Organización' },
  { value: 'SCHEDULE_CHANGE', label: 'Horario' },
  { value: 'CAPACITY_ALERT', label: 'Aforo' },
];

const DEMO_TYPES: { value: EventNotificationType; label: string }[] = [
  { value: 'ORGANIZATION_NOTICE', label: 'Aviso general' },
  { value: 'SCHEDULE_CHANGE', label: 'Cambio de horario' },
  { value: 'CAPACITY_ALERT', label: 'Cierre de aforo' },
];

export default function NotificationCenter({
  visible,
  notifications,
  zones,
  unreadCount,
  isOnline,
  canSimulate,
  permissionState,
  error,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onSimulate,
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<EventNotificationFilter>('ALL');
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const sortedNotifications = useMemo(
    () => filterAndSortEventNotifications(notifications, filter),
    [notifications, filter],
  );
  const relatedZoneId = zones[0]?.id ?? null;

  const handleSimulation = async (type: EventNotificationType) => {
    const simulated = await onSimulate(type, relatedZoneId);
    setSimulationMessage(
      simulated
        ? permissionState === 'granted'
          ? 'Aviso de prueba recibido; se guardó y se programó una notificación del sistema.'
          : 'Aviso de prueba recibido y guardado. Los avisos in-app siguen activos.'
        : isOnline
          ? 'No se pudo generar el aviso de prueba. Revisa el error mostrado.'
          : 'Conéctate para simular la recepción de avisos.',
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR WAY</Text>
              <Text style={styles.title}>Centro de avisos</Text>
              <Text style={styles.subtitle}>
                {unreadCount === 0 ? 'Todo está al día' : `${unreadCount} sin leer`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar centro de avisos"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marcar todos los avisos como leídos"
              onPress={() => void onMarkAllRead()}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllText}>Marcar todos como leídos</Text>
            </Pressable>
          ) : null}

          <ScrollView
            horizontal
            contentContainerStyle={styles.filters}
            showsHorizontalScrollIndicator={false}
          >
            {FILTERS.map((item) => {
              const selected = filter === item.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar avisos: ${item.label}`}
                  accessibilityState={{ selected }}
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  style={[styles.filterButton, selected && styles.selectedFilter]}
                >
                  <Text style={[styles.filterText, selected && styles.selectedFilterText]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.notificationList}>
            {sortedNotifications.length === 0 ? (
              <Text style={styles.emptyText}>No hay avisos para este filtro.</Text>
            ) : (
              sortedNotifications.map((notification) => {
                const zoneName = getRelatedZoneName(notification, zones);
                const typeInfo = notificationTypeInfo(notification.type);
                return (
                  <View
                    key={notification.id}
                    style={[
                      styles.notificationCard,
                      !notification.is_read && styles.unreadCard,
                    ]}
                  >
                    <View style={styles.cardHeading}>
                      <Text style={styles.typeLabel}>
                        {typeInfo.icon} {typeInfo.label}
                      </Text>
                      <Text style={styles.readLabel}>
                        {notification.is_read ? 'Leído' : 'Nuevo'}
                      </Text>
                    </View>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationContent}>{notification.content}</Text>
                    {notification.type !== 'ORGANIZATION_NOTICE' ? (
                      <Text style={styles.zoneName}>
                        Sala: {zoneName ?? 'no especificada o no disponible'}
                      </Text>
                    ) : null}
                    <Text style={styles.dateLabel}>{formatDate(notification.received_at)}</Text>
                    {!notification.is_read ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marcar como leído: ${notification.title}`}
                        onPress={() => void onMarkRead(notification.id)}
                        style={styles.markReadButton}
                      >
                        <Text style={styles.markReadText}>Marcar como leído</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>

          {__DEV__ ? (
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Pruebas de desarrollo</Text>
              <Text style={styles.demoHint}>
                {canSimulate
                  ? 'Simula un aviso del servidor; se guarda y, con permiso, se muestra también en el sistema.'
                  : 'Conéctate a internet para habilitar la simulación.'}
              </Text>
              <View style={styles.demoButtons}>
                {DEMO_TYPES.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Simular aviso: ${item.label}`}
                    accessibilityState={{ disabled: !canSimulate }}
                    disabled={!canSimulate}
                    key={item.value}
                    onPress={() => void handleSimulation(item.value)}
                    style={[styles.demoButton, !canSimulate && styles.disabledButton]}
                  >
                    <Text style={styles.demoButtonText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              {!isOnline ? (
                <Text style={styles.offlineLabel}>Modo offline: solo se consultan avisos guardados.</Text>
              ) : null}
              {permissionState !== 'granted' ? (
                <Text style={styles.demoHint}>
                  Sin permiso del sistema, la simulación solo aparecerá dentro de la app.
                </Text>
              ) : null}
              {simulationMessage ? <Text style={styles.simulationMessage}>{simulationMessage}</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

function notificationTypeInfo(type: EventNotificationType): { icon: string; label: string } {
  switch (type) {
    case 'ORGANIZATION_NOTICE':
      return { icon: '📣', label: 'ORGANIZACIÓN' };
    case 'SCHEDULE_CHANGE':
      return { icon: '🗓️', label: 'CAMBIO DE HORARIO' };
    case 'CAPACITY_ALERT':
      return { icon: '⚠️', label: 'ALERTA DE AFORO' };
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-ES');
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 35, 31, 0.44)',
  },
  panel: {
    height: '92%',
    backgroundColor: '#F3F6F4',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: { color: '#56736D', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#173A35', fontSize: 22, fontWeight: '700', marginTop: 3 },
  subtitle: { color: '#5A6A64', fontSize: 12, marginTop: 3 },
  closeButton: { paddingHorizontal: 10, paddingVertical: 5 },
  closeText: { color: '#173A35', fontSize: 28, lineHeight: 30 },
  markAllButton: { alignSelf: 'flex-end', paddingVertical: 6 },
  markAllText: { color: '#13695F', fontSize: 12, fontWeight: '700' },
  filters: { gap: 7, paddingVertical: 9 },
  filterButton: {
    borderWidth: 1,
    borderColor: '#7E8E88',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedFilter: { backgroundColor: '#13695F', borderColor: '#13695F' },
  filterText: { color: '#526B63', fontSize: 11, fontWeight: '600' },
  selectedFilterText: { color: '#FFFFFF' },
  notificationList: { flex: 1, marginTop: 4 },
  emptyText: { color: '#5A6A64', fontSize: 13, paddingVertical: 24, textAlign: 'center' },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7E8E88',
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 9,
    padding: 13,
  },
  unreadCard: { borderLeftColor: '#13695F', borderLeftWidth: 4 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  typeLabel: { color: '#13695F', fontSize: 10, fontWeight: '700', flex: 1 },
  readLabel: { color: '#5A6A64', fontSize: 10 },
  notificationTitle: { color: '#243E39', fontSize: 14, fontWeight: '700', marginTop: 7 },
  notificationContent: { color: '#526B63', fontSize: 12, lineHeight: 18, marginTop: 4 },
  zoneName: { color: '#425B54', fontSize: 11, fontWeight: '600', marginTop: 7 },
  dateLabel: { color: '#5A6A64', fontSize: 10, marginTop: 7 },
  markReadButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  markReadText: { color: '#13695F', fontSize: 11, fontWeight: '700' },
  demoSection: {
    backgroundColor: '#E7F0EC',
    borderRadius: 12,
    marginTop: 9,
    padding: 12,
  },
  demoTitle: { color: '#173A35', fontSize: 12, fontWeight: '700' },
  demoHint: { color: '#526B63', fontSize: 10, lineHeight: 15, marginTop: 4 },
  demoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  demoButton: { backgroundColor: '#13695F', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  disabledButton: { backgroundColor: '#91A7A0' },
  demoButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  offlineLabel: { color: '#825510', fontSize: 10, fontWeight: '600', marginTop: 7 },
  simulationMessage: { color: '#25635A', fontSize: 10, lineHeight: 15, marginTop: 7 },
  errorText: { color: '#8B3E35', fontSize: 11, marginTop: 7 },
});
