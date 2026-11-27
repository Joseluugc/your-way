import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  etiquetaAccesibleSello,
  formatearEstrellas,
  formatearFechaSello,
  type PassportStampCardData,
} from '../domain/gamification/passportView';

interface PassportStampCardProps {
  card: PassportStampCardData;
  indice: number;
  total: number;
  onPress: (card: PassportStampCardData) => void;
}

/**
 * Tarjeta de un sello del pasaporte (Spec 09). El estado se distingue sin color: icono,
 * texto y borde (discontinuo si está bloqueada). Los iconos se ocultan al lector de pantalla,
 * que lee la etiqueta completa de `etiquetaAccesibleSello`.
 */
export default function PassportStampCard({ card, indice, total, onPress }: PassportStampCardProps) {
  const bloqueada = card.estado === 'BLOQUEADO';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesibleSello(card, indice, total)}
      accessibilityHint={bloqueada ? 'Muestra cómo conseguir este sello' : 'Muestra el detalle del sello'}
      onPress={() => onPress(card)}
      style={({ pressed }) => [
        styles.tarjeta,
        bloqueada ? styles.tarjetaBloqueada : styles.tarjetaDesbloqueada,
        pressed && styles.pulsada,
      ]}
      testID={`passport-stamp-${card.standId}`}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.icono}
      >
        {bloqueada ? '🔒' : '🏅'}
      </Text>
      {card.estado === 'BLOQUEADO' ? (
        <Text style={styles.textoBloqueado}>Bloqueado</Text>
      ) : (
        <View style={styles.datos}>
          <Text style={styles.nombre} numberOfLines={2}>
            {card.standName}
          </Text>
          <Text style={styles.detalle}>{formatearFechaSello(card.scannedAt)}</Text>
          <Text style={styles.xp}>+{card.xpGanada} XP</Text>
          <Text style={card.estrellas === null ? styles.sinValorar : styles.estrellas}>
            {card.estrellas === null ? 'Sin valorar' : formatearEstrellas(card.estrellas)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flex: 1,
    minHeight: 160,
    minWidth: 44,
    margin: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaBloqueada: { backgroundColor: '#F2F4F3', borderColor: '#5A6A64', borderStyle: 'dashed' },
  tarjetaDesbloqueada: { backgroundColor: '#E7F4EC', borderColor: '#13695F', borderStyle: 'solid' },
  pulsada: { opacity: 0.75 },
  icono: { fontSize: 32, marginBottom: 6 },
  textoBloqueado: { fontSize: 15, fontWeight: '600', color: '#304A44' },
  datos: { alignItems: 'center' },
  nombre: { fontSize: 15, fontWeight: '700', color: '#173A35', textAlign: 'center', marginBottom: 4 },
  detalle: { fontSize: 13, color: '#304A44' },
  xp: { fontSize: 14, fontWeight: '700', color: '#13695F', marginTop: 2 },
  estrellas: { fontSize: 16, color: '#8A5A00', marginTop: 2 },
  sinValorar: { fontSize: 13, fontStyle: 'italic', color: '#304A44', marginTop: 2 },
});
