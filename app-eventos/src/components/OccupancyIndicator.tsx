import { StyleSheet, Text, View } from 'react-native';
import { getOccupancyStatus } from '../domain/map/occupancyStatus';
import type { OccupancyLevel } from '../domain/map/mapTypes';

interface OccupancyIndicatorProps {
  level: OccupancyLevel;
  /** Muestra también el texto del nivel junto al icono. */
  showLabel?: boolean;
}

/**
 * Semáforo de aforo: círculo de color con un icono distinto por nivel y, opcionalmente,
 * el texto del nivel. El icono es decorativo para el lector de pantalla: el nivel se
 * anuncia con la etiqueta accesible del propio indicador.
 */
export default function OccupancyIndicator({ level, showLabel = false }: OccupancyIndicatorProps) {
  const status = getOccupancyStatus(level);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Aforo: ${status.label}`}
      style={styles.row}
      testID={`occupancy-indicator-${level}`}
    >
      <View style={[styles.badge, { backgroundColor: status.color }]}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.icon}
          testID={`occupancy-icon-${level}`}
        >
          {status.icon}
        </Text>
      </View>
      {showLabel ? <Text style={styles.label}>{status.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  label: { color: '#26302C', fontSize: 12, fontWeight: '700' },
});
