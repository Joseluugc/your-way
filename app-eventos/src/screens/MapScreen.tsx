import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useMapData } from '../hooks/useMapData';
import { useEventNotifications } from '../providers/NotificationProvider';
import type { Stand, ZoneOccupancy } from '../domain/map/mapTypes';
import type { OrganizationAlertType } from '../domain/notifications/organizationAlert';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 680;
const ZONE_LEVEL_COLORS = {
  available: '#2A9661',
  medium: '#E89A2C',
  full: '#D84F4F',
  unavailable: '#8B9691',
} as const;

type SelectedMapItem =
  | { kind: 'stand'; value: Stand }
  | { kind: 'zone'; value: ZoneOccupancy };

export default function MapScreen() {
  const { snapshot, loading, error, isOffline, refresh } = useMapData();
  const {
    alerts,
    permissionState,
    error: notificationError,
    requestPermission,
  } = useEventNotifications();
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const panStart = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });

  const handlePanGrant = useCallback(() => {
    panStart.current = panRef.current;
  }, []);

  const handlePanMove = useCallback(
    (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const nextPan = {
        x: panStart.current.x + (gesture.dx * VIEW_WIDTH) / viewport.width,
        y: panStart.current.y + (gesture.dy * VIEW_HEIGHT) / viewport.height,
      };
      panRef.current = nextPan;
      setPan(nextPan);
    },
    [viewport.height, viewport.width],
  );

  const panResponder = useMemo(
    () => {
      // PanResponder invokes these callbacks on gesture events, not during render.
      // eslint-disable-next-line react-hooks/refs
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onPanResponderGrant: handlePanGrant,
        onPanResponderMove: handlePanMove,
      });
    },
    [handlePanGrant, handlePanMove],
  );

  const stands = useMemo(() => {
    const validStands = snapshot?.stands.filter(
      (stand) => Number.isFinite(stand.map_x) && Number.isFinite(stand.map_y),
    ) ?? [];
    if (validStands.length === 0) {
      return [];
    }

    const minX = Math.min(...validStands.map((stand) => stand.map_x));
    const maxX = Math.max(...validStands.map((stand) => stand.map_x));
    const minY = Math.min(...validStands.map((stand) => stand.map_y));
    const maxY = Math.max(...validStands.map((stand) => stand.map_y));
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return validStands.map((stand) => ({
      stand,
      x: 100 + ((stand.map_x - minX) / rangeX) * 800,
      y: 110 + ((stand.map_y - minY) / rangeY) * 340,
    }));
  }, [snapshot?.stands]);

  const zoneMarkers = useMemo(() => {
    const zones = snapshot?.zones ?? [];
    const columns = Math.min(3, Math.max(1, zones.length));
    const columnWidth = 860 / columns;

    return zones.map((zone, index) => ({
      zone,
      x: 70 + (index % columns) * columnWidth,
      y: 535 + Math.floor(index / columns) * 70,
      width: Math.min(260, columnWidth - 18),
    }));
  }, [snapshot?.zones]);

  const handleZoom = (direction: 1 | -1) => {
    setZoom((current) => Math.min(3, Math.max(0.5, current + direction * 0.25)));
  };

  const timestampLabel = snapshot?.last_synced_at
    ? new Date(snapshot.last_synced_at).toLocaleString('es-ES')
    : 'Sin sincronización confirmada';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR WAY / RECINTO</Text>
            <Text style={styles.title}>Mapa y aforo</Text>
          </View>
          <View style={[styles.networkBadge, isOffline && styles.offlineBadge]}>
            <View style={[styles.networkDot, isOffline && styles.offlineDot]} />
            <Text style={[styles.networkLabel, isOffline && styles.offlineLabel]}>
              {isOffline ? 'Sin conexión' : 'Datos locales'}
            </Text>
          </View>
        </View>

        <Text style={styles.syncLabel}>
          Aforo: {timestampLabel}
          {isOffline ? ' · último dato guardado' : ''}
        </Text>

        <View style={styles.mapHeading}>
          <View>
            <Text style={styles.sectionTitle}>Plano 2D</Text>
            <Text style={styles.sectionSubtitle}>
              Estands en coordenadas; zonas esquemáticas y sin escala.
            </Text>
          </View>
          <View style={styles.zoomControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reducir zoom"
              onPress={() => handleZoom(-1)}
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
            <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aumentar zoom"
              onPress={() => handleZoom(1)}
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View
          onLayout={(event) =>
            setViewport({
              width: Math.max(event.nativeEvent.layout.width, 1),
              height: Math.max(event.nativeEvent.layout.height, 1),
            })
          }
          style={styles.mapFrame}
        >
          <Svg
            accessibilityLabel="Plano 2D interactivo del recinto"
            height="100%"
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            width="100%"
            {...panResponder.panHandlers}
          >
            <Rect fill="#FBFDFC" height={VIEW_HEIGHT} rx="24" width={VIEW_WIDTH} />
            <G transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {Array.from({ length: 19 }, (_, index) => (
                <Line
                  key={`vertical-${index}`}
                  stroke="#E8EFEB"
                  strokeWidth="1"
                  x1={50 + index * 50}
                  x2={50 + index * 50}
                  y1="30"
                  y2="480"
                />
              ))}
              {Array.from({ length: 10 }, (_, index) => (
                <Line
                  key={`horizontal-${index}`}
                  stroke="#E8EFEB"
                  strokeWidth="1"
                  x1="30"
                  x2="970"
                  y1={55 + index * 48}
                  y2={55 + index * 48}
                />
              ))}
              <SvgText fill="#71827D" fontSize="19" fontWeight="700" x="48" y="46">
                ESTANDS
              </SvgText>
              {stands.map(({ stand, x, y }) => (
                <G key={stand.id}>
                  <Circle
                    accessibilityLabel={`Estand ${stand.name}. Pulsa para ver la ficha.`}
                    cx={x}
                    cy={y}
                    fill="#167B71"
                    onPress={() => setSelectedItem({ kind: 'stand', value: stand })}
                    r="24"
                    stroke="#FFFFFF"
                    strokeWidth="5"
                  />
                  <SvgText
                    fill="#173A35"
                    fontSize="18"
                    fontWeight="700"
                    textAnchor="middle"
                    x={x}
                    y={y + 48}
                  >
                    {truncate(stand.name, 18)}
                  </SvgText>
                </G>
              ))}
              {stands.length === 0 ? (
                <SvgText fill="#71827D" fontSize="22" textAnchor="middle" x="500" y="255">
                  No hay estands con coordenadas disponibles
                </SvgText>
              ) : null}

              <SvgText fill="#71827D" fontSize="19" fontWeight="700" x="48" y="510">
                ZONAS · ESQUEMA SIN ESCALA
              </SvgText>
              {zoneMarkers.map(({ zone, x, y, width }) => (
                <G key={zone.zone.id}>
                  <Rect
                    accessibilityLabel={zoneAccessibilityLabel(zone)}
                    fill={ZONE_LEVEL_COLORS[zone.level]}
                    height="58"
                    onPress={() => setSelectedItem({ kind: 'zone', value: zone })}
                    rx="14"
                    width={width}
                    x={x}
                    y={y}
                  />
                  <SvgText
                    fill="#FFFFFF"
                    fontSize="16"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={x + width / 2}
                    y={y + 25}
                  >
                    {truncate(zone.zone.name, 23)}
                  </SvgText>
                  <SvgText
                    fill="#FFFFFF"
                    fontSize="13"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={x + width / 2}
                    y={y + 45}
                  >
                    {zone.current_capacity} / {zone.zone.max_capacity}
                  </SvgText>
                </G>
              ))}
            </G>
          </Svg>
        </View>
        <Text style={styles.gestureHint}>
          Arrastra el plano para desplazarte y usa + / − para cambiar el zoom.
        </Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !snapshot ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#167B71" />
            <Text style={styles.mutedText}>Cargando datos locales del mapa…</Text>
          </View>
        ) : null}

        <View style={styles.legend}>
          <LegendItem color={ZONE_LEVEL_COLORS.available} label="Disponible · < 70 %" />
          <LegendItem color={ZONE_LEVEL_COLORS.medium} label="Aforo medio · 70–94 %" />
          <LegendItem color={ZONE_LEVEL_COLORS.full} label="Completo · ≥ 95 %" />
          <LegendItem color={ZONE_LEVEL_COLORS.unavailable} label="Aforo no disponible" />
        </View>

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
          Las zonas se muestran como marcadores esquemáticos.
        </Text>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
        transparent
        visible={selectedItem !== null}
      >
        <Pressable style={styles.modalScrim} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.detailSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            {selectedItem?.kind === 'stand' ? (
              <>
                <Text style={styles.sheetEyebrow}>ESTAND</Text>
                <Text style={styles.sheetTitle}>{selectedItem.value.name}</Text>
                <Text style={styles.sheetDetail}>
                  Coordenadas del plano: {selectedItem.value.map_x}, {selectedItem.value.map_y}
                </Text>
              </>
            ) : null}
            {selectedItem?.kind === 'zone' ? (
              <>
                <Text style={styles.sheetEyebrow}>ZONA</Text>
                <Text style={styles.sheetTitle}>{selectedItem.value.zone.name}</Text>
                <Text style={styles.sheetDetail}>
                  Aforo derivado de registros: {selectedItem.value.current_capacity} /{' '}
                  {selectedItem.value.zone.max_capacity}
                </Text>
                <Text style={styles.sheetDetail}>
                  {occupancyLabel(selectedItem.value.level)}
                  {selectedItem.value.occupancy_percentage === null
                    ? ''
                    : ` · ${Math.round(selectedItem.value.occupancy_percentage)} %`}
                </Text>
                <Text style={styles.sheetDetail}>
                  Acceso requerido: {selectedItem.value.zone.required_role ?? 'No especificado'}
                </Text>
              </>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedItem(null)}
              style={styles.sheetCloseButton}
            >
              <Text style={styles.sheetCloseText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function zoneAccessibilityLabel(zone: ZoneOccupancy): string {
  const percentage =
    zone.occupancy_percentage === null
      ? 'aforo no disponible'
      : `${Math.round(zone.occupancy_percentage)} por ciento, ${occupancyLabel(zone.level)}`;
  return `${zone.zone.name}, ${zone.current_capacity} de ${zone.zone.max_capacity}, ${percentage}. Pulsa para ver detalles.`;
}

function occupancyLabel(level: ZoneOccupancy['level']): string {
  switch (level) {
    case 'available':
      return 'Disponible';
    case 'medium':
      return 'Aforo medio';
    case 'full':
      return 'Aforo completo';
    case 'unavailable':
      return 'Aforo no disponible';
  }
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

function truncate(value: string, maximumLength: number): string {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 1)}…` : value;
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
  mapHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { color: '#173A35', fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: '#71827D', fontSize: 11, marginTop: 3 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  zoomButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE6E1',
  },
  zoomButtonText: { color: '#167B71', fontSize: 21, fontWeight: '600', lineHeight: 24 },
  zoomValue: { minWidth: 40, color: '#45625B', fontSize: 11, textAlign: 'center' },
  mapFrame: {
    width: '100%',
    height: 310,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE6E1',
    backgroundColor: '#FBFDFC',
  },
  gestureHint: { color: '#71827D', fontSize: 10, marginTop: 7 },
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
  loadingState: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 9 },
  mutedText: { color: '#6E817C', fontSize: 12, marginTop: 8 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: '#526B63', fontSize: 10 },
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
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 30, 26, 0.38)',
  },
  detailSheet: {
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6E0DB',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetEyebrow: { color: '#167B71', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  sheetTitle: { color: '#173A35', fontSize: 22, fontWeight: '700', marginTop: 5 },
  sheetDetail: { color: '#526B63', fontSize: 13, lineHeight: 20, marginTop: 8 },
  sheetCloseButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#E8F1ED',
    marginTop: 20,
  },
  sheetCloseText: { color: '#167B71', fontSize: 14, fontWeight: '700' },
});
