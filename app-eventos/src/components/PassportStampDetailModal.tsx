import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatearEstrellas,
  formatearFechaSello,
  type PassportStampCardData,
} from '../domain/gamification/passportView';

interface PassportStampDetailModalProps {
  /** Tarjeta seleccionada; `null` cierra la ventana. */
  card: PassportStampCardData | null;
  onClose: () => void;
}

/**
 * Ficha de solo lectura de un sello (Spec 09, US-09.2). Desbloqueado: detalle del sello.
 * Bloqueado: pista para conseguirlo. Se cierra con «Cerrar» o con el botón atrás de Android.
 */
export default function PassportStampDetailModal({ card, onClose }: PassportStampDetailModalProps) {
  return (
    <Modal visible={card !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <View style={styles.ventana} accessibilityViewIsModal>
          {card === null ? null : card.estado === 'BLOQUEADO' ? (
            <>
              <Text style={styles.titulo} accessibilityRole="header">
                Sello bloqueado
              </Text>
              <Text style={styles.texto}>Acerca tu móvil al NFC del estand para conseguir este sello</Text>
            </>
          ) : (
            <>
              <Text style={styles.titulo} accessibilityRole="header">
                {card.standName}
              </Text>
              <Text style={styles.texto}>Conseguido: {formatearFechaSello(card.scannedAt)}</Text>
              <Text style={styles.texto}>XP ganada: +{card.xpGanada} XP</Text>
              <Text
                style={styles.texto}
                accessibilityLabel={
                  card.estrellas === null
                    ? 'Valoración: sin valorar'
                    : `Valoración: ${card.estrellas} de 5 estrellas`
                }
              >
                Valoración: {card.estrellas === null ? 'Sin valorar' : formatearEstrellas(card.estrellas)}
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={({ pressed }) => [styles.boton, pressed && styles.botonPulsado]}
          >
            <Text style={styles.textoBoton}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ventana: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#173A35', marginBottom: 12 },
  texto: { fontSize: 16, color: '#304A44', marginBottom: 8 },
  boton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#13695F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPulsado: { opacity: 0.8 },
  textoBoton: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
