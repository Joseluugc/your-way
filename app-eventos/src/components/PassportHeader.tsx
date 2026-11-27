import { StyleSheet, Text, View } from 'react-native';
import type { ProgresoPasaporte } from '../domain/gamification/passportView';

interface PassportHeaderProps {
  xpTotal: number;
  progreso: ProgresoPasaporte;
}

/** Cabecera del pasaporte (Spec 09): XP total, «n/total sellos» y barra de progreso. */
export default function PassportHeader({ xpTotal, progreso }: PassportHeaderProps) {
  const { conseguidos, total, porcentaje } = progreso;

  return (
    <View style={styles.cabecera}>
      <View style={styles.fila}>
        <Text style={styles.xp} accessibilityLabel={`${xpTotal} XP en total`}>
          {xpTotal} XP
        </Text>
        <Text style={styles.sellos} accessibilityLabel={`${conseguidos} de ${total} sellos`}>
          {conseguidos}/{total} sellos
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progreso del pasaporte"
        accessibilityValue={{ min: 0, max: total, now: conseguidos }}
        style={styles.barra}
      >
        <View style={[styles.relleno, { width: `${porcentaje}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  xp: { fontSize: 24, fontWeight: '800', color: '#13695F' },
  sellos: { fontSize: 16, fontWeight: '600', color: '#173A35' },
  barra: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DCE5E2',
    borderWidth: 1,
    borderColor: '#5A6A64',
    overflow: 'hidden',
  },
  relleno: { height: '100%', backgroundColor: '#13695F' },
});
