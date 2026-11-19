import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Stand, Zone } from '../domain/map/mapTypes';

const VIEW_WIDTH = 1000;
const BASE_VIEW_HEIGHT = 800;
const ZONES_TOP = 650;
const ZONE_ROW_HEIGHT = 110;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
const MAX_STAND_NAME_LENGTH = 22;
const MAX_ZONE_NAME_LENGTH = 25;

interface EventMapCanvasProps {
  stands: readonly Stand[];
  zones: readonly Zone[];
  loading?: boolean;
  demoData?: boolean;
  onPanningChange?: (panning: boolean) => void;
}

type SelectedMapItem =
  | { kind: 'stand'; value: Stand }
  | { kind: 'zone'; value: Zone };

interface Point {
  x: number;
  y: number;
}

export default function EventMapCanvas({
  stands,
  zones,
  loading = false,
  demoData = false,
  onPanningChange,
}: EventMapCanvasProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  const zoneColumns = Math.min(3, Math.max(1, zones.length));
  const viewHeight = Math.max(
    BASE_VIEW_HEIGHT,
    ZONES_TOP + Math.ceil(zones.length / zoneColumns) * ZONE_ROW_HEIGHT + 20,
  );
  const pixelsPerUnit = Math.min(viewport.width / VIEW_WIDTH, viewport.height / viewHeight);

  const positionedStands = useMemo(() => getPositionedStands(stands), [stands]);
  const zoneMarkers = useMemo(() => {
    const columnWidth = 860 / zoneColumns;

    return zones.map((zone, index) => ({
      zone,
      x: 70 + (index % zoneColumns) * columnWidth,
      y: ZONES_TOP + Math.floor(index / zoneColumns) * ZONE_ROW_HEIGHT,
      width: Math.min(260, columnWidth - 18),
    }));
  }, [zoneColumns, zones]);

  const handlePanGrant = useCallback(() => {
    panStart.current = panRef.current;
    onPanningChange?.(true);
  }, [onPanningChange]);

  const handlePanMove = useCallback(
    (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const nextPan = clampPan(
        {
          x: panStart.current.x + gesture.dx / Math.max(pixelsPerUnit, 0.01),
          y: panStart.current.y + gesture.dy / Math.max(pixelsPerUnit, 0.01),
        },
        zoomRef.current,
        viewHeight,
      );
      panRef.current = nextPan;
      setPan(nextPan);
    },
    [pixelsPerUnit, viewHeight],
  );

  const handlePanEnd = useCallback(() => onPanningChange?.(false), [onPanningChange]);

  const panResponder = useMemo(
    () => {
      // PanResponder reads these callbacks only in response to touch gestures.
      // eslint-disable-next-line react-hooks/refs
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: handlePanGrant,
        onPanResponderMove: handlePanMove,
        onPanResponderRelease: handlePanEnd,
        onPanResponderTerminate: handlePanEnd,
      });
    },
    [handlePanEnd, handlePanGrant, handlePanMove],
  );

  const handleZoom = (direction: 1 | -1) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + direction * 0.25));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    const nextPan = clampPan(panRef.current, nextZoom, viewHeight);
    panRef.current = nextPan;
    setPan(nextPan);
  };

  const empty = stands.length === 0 && zones.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Plano 2D</Text>
          <Text style={styles.subtitle}>Toca un estand o una sala para ver su nombre.</Text>
        </View>
        <View style={styles.zoomControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reducir zoom del mapa"
            disabled={empty}
            onPress={() => handleZoom(-1)}
            style={[styles.zoomButton, empty && styles.disabledButton]}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </Pressable>
          <Text accessibilityLabel={`Zoom ${Math.round(zoom * 100)} por ciento`} style={styles.zoomValue}>
            {Math.round(zoom * 100)}%
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aumentar zoom del mapa"
            disabled={empty}
            onPress={() => handleZoom(1)}
            style={[styles.zoomButton, empty && styles.disabledButton]}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      {demoData ? (
        <Text style={styles.demoNotice}>Datos de ejemplo para probar el mapa.</Text>
      ) : null}

      {empty ? (
        <View accessibilityLiveRegion="polite" style={styles.emptyState}>
          {loading ? <ActivityIndicator color="#167B71" /> : null}
          <Text style={styles.emptyTitle}>
            {loading ? 'Cargando el plano…' : 'Todavía no hay elementos en el mapa'}
          </Text>
          <Text style={styles.emptyDescription}>
            {loading
              ? 'El plano aparecerá aquí cuando estén disponibles sus datos.'
              : 'Los estands y las salas aparecerán aquí cuando se añadan al evento.'}
          </Text>
        </View>
      ) : (
        <>
          <View
            onLayout={(event) =>
              setViewport({
                width: Math.max(event.nativeEvent.layout.width, 1),
                height: Math.max(event.nativeEvent.layout.height, 1),
              })
            }
            {...panResponder.panHandlers}
            style={styles.mapFrame}
          >
            <Svg
              accessibilityLabel="Plano 2D interactivo con estands y salas"
              height="100%"
              pointerEvents="none"
              viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
              width="100%"
            >
              <Rect fill="#FBFDFC" height={viewHeight} rx="24" width={VIEW_WIDTH} />
              <G
                transform={`translate(${pan.x} ${pan.y}) translate(${VIEW_WIDTH / 2} ${viewHeight / 2}) scale(${zoom}) translate(${-VIEW_WIDTH / 2} ${-viewHeight / 2})`}
              >
                {Array.from({ length: 19 }, (_, index) => (
                  <Line
                    key={`vertical-${index}`}
                    stroke="#E8EFEB"
                    strokeWidth="1"
                    x1={50 + index * 50}
                    x2={50 + index * 50}
                    y1="30"
                    y2="610"
                  />
                ))}
                {Array.from({ length: 13 }, (_, index) => (
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
                {positionedStands.map(({ stand, x, y }) => (
                  <G key={stand.id}>
                    <Circle
                      cx={x}
                      cy={y}
                      fill="#167B71"
                      r="28"
                      stroke="#FFFFFF"
                      strokeWidth="5"
                    />
                    <SvgText
                      fill="#173A35"
                      fontSize="18"
                      fontWeight="700"
                      pointerEvents="none"
                      textAnchor="middle"
                      x={x}
                      y={y + 50}
                    >
                      {truncate(stand.name, MAX_STAND_NAME_LENGTH)}
                    </SvgText>
                  </G>
                ))}

                <SvgText fill="#71827D" fontSize="19" fontWeight="700" x="48" y="635">
                  SALAS · MARCADORES SIN GEOMETRÍA
                </SvgText>
                {zoneMarkers.map(({ zone, x, y, width }) => (
                  <G key={zone.id}>
                    <Circle
                      cx={x + width / 2}
                      cy={y + 34}
                      fill="#DCEBE5"
                      stroke="#8DB5A5"
                      strokeWidth="2"
                      r="34"
                    />
                    <SvgText
                      fill="#173A35"
                      fontSize="17"
                      fontWeight="700"
                      pointerEvents="none"
                      textAnchor="middle"
                      x={x + width / 2}
                      y={y + 88}
                    >
                      {truncate(zone.name, MAX_ZONE_NAME_LENGTH)}
                    </SvgText>
                  </G>
                ))}
              </G>
            </Svg>
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {positionedStands.map(({ stand, x, y }) => {
                const point = toViewportPoint({ x, y }, pan, zoom, viewport, viewHeight);
                return (
                  <Pressable
                    key={stand.id}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Estand: ${stand.name}. Pulsa para ver su ficha.`}
                    onPress={() => setSelectedItem({ kind: 'stand', value: stand })}
                    style={[
                      styles.markerHitTarget,
                      { left: point.x - 28, top: point.y - 28 },
                    ]}
                  />
                );
              })}
              {zoneMarkers.map(({ zone, x, y, width }) => {
                const point = toViewportPoint(
                  { x: x + width / 2, y: y + 34 },
                  pan,
                  zoom,
                  viewport,
                  viewHeight,
                );
                return (
                  <Pressable
                    key={zone.id}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Sala: ${zone.name}. Pulsa para ver su ficha.`}
                    onPress={() => setSelectedItem({ kind: 'zone', value: zone })}
                    style={[
                      styles.markerHitTarget,
                      { left: point.x - 28, top: point.y - 28 },
                    ]}
                  />
                );
              })}
            </View>
          </View>
          <Text style={styles.gestureHint}>Arrastra el plano para desplazarte y usa + / − para el zoom.</Text>
          <Text style={styles.note}>
            Las salas se muestran como marcadores; el modelo actual no define coordenadas ni
            geometría para sus contornos.
          </Text>
        </>
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
        transparent
        visible={selectedItem !== null}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar ficha"
          onPress={() => setSelectedItem(null)}
          style={styles.modalScrim}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={styles.detailSheet}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>
              {selectedItem?.kind === 'stand' ? 'ESTAND' : 'SALA'}
            </Text>
            <Text style={styles.sheetTitle}>{selectedItem?.value.name}</Text>
            {selectedItem?.kind === 'stand' ? (
              <Text style={styles.sheetDetail}>
                Posición en el plano: {selectedItem.value.map_x}, {selectedItem.value.map_y}
              </Text>
            ) : null}
            {selectedItem?.kind === 'zone' ? (
              <Text style={styles.sheetDetail}>
                {getZoneOccupancySummary(selectedItem.value)}
              </Text>
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
    </View>
  );
}

function getZoneOccupancySummary(zone: Zone): string {
  const capacity = zone.current_capacity;
  const maximum = zone.max_capacity;
  if (
    capacity === null ||
    !Number.isFinite(capacity) ||
    capacity < 0 ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return 'Estado de aforo no disponible';
  }
  return `${capacity} / ${maximum} asistentes`;
}

function toViewportPoint(
  point: Point,
  pan: Point,
  zoom: number,
  viewport: { width: number; height: number },
  viewHeight: number,
): Point {
  const scale = Math.min(viewport.width / VIEW_WIDTH, viewport.height / viewHeight);
  const offsetX = (viewport.width - VIEW_WIDTH * scale) / 2;
  const offsetY = (viewport.height - viewHeight * scale) / 2;
  const x = pan.x + VIEW_WIDTH / 2 + zoom * (point.x - VIEW_WIDTH / 2);
  const y = pan.y + viewHeight / 2 + zoom * (point.y - viewHeight / 2);
  return {
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  };
}

function getPositionedStands(stands: readonly Stand[]): ({ stand: Stand } & Point)[] {
  const validStands = stands.filter(
    (stand) => Number.isFinite(stand.map_x) && Number.isFinite(stand.map_y),
  );
  if (validStands.length === 0) {
    return [];
  }

  const minX = Math.min(...validStands.map((stand) => stand.map_x));
  const maxX = Math.max(...validStands.map((stand) => stand.map_x));
  const minY = Math.min(...validStands.map((stand) => stand.map_y));
  const maxY = Math.max(...validStands.map((stand) => stand.map_y));
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  return validStands.map((stand) => ({
    stand,
    x: rangeX === 0 ? 500 : 100 + ((stand.map_x - minX) / rangeX) * 800,
    y: rangeY === 0 ? 340 : 100 + ((stand.map_y - minY) / rangeY) * 430,
  }));
}

function clampPan(pan: Point, zoom: number, viewHeight: number): Point {
  const limitX = (VIEW_WIDTH * zoom) / 2;
  const limitY = (viewHeight * zoom) / 2;
  return {
    x: Math.min(limitX, Math.max(-limitX, pan.x)),
    y: Math.min(limitY, Math.max(-limitY, pan.y)),
  };
}

function truncate(value: string, maximumLength: number): string {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 1)}…` : value;
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingCopy: { flex: 1, paddingRight: 8 },
  title: { color: '#173A35', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#71827D', fontSize: 11, marginTop: 3 },
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
  disabledButton: { opacity: 0.5 },
  zoomButtonText: { color: '#167B71', fontSize: 21, fontWeight: '600', lineHeight: 24 },
  zoomValue: { minWidth: 40, color: '#45625B', fontSize: 11, textAlign: 'center' },
  markerHitTarget: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
  },
  demoNotice: { color: '#825510', fontSize: 10, marginBottom: 8 },
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
  note: { color: '#71827D', fontSize: 10, lineHeight: 15, marginTop: 5 },
  emptyState: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D8D1',
    borderRadius: 16,
    backgroundColor: '#FBFDFC',
  },
  emptyTitle: { color: '#243E39', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  emptyDescription: { color: '#71827D', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
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
