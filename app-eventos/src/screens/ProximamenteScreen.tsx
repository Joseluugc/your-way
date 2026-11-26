import { StyleSheet, Text, View } from 'react-native';

/** Pantalla provisional para las pestañas sin terminar (Spec 08, US-08.4). */
export default function ProximamenteScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo} accessibilityRole="header">
        Próximamente
      </Text>
      <Text style={styles.texto}>Esta sección estará disponible en una próxima versión.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  titulo: { fontSize: 22, fontWeight: '700', color: '#173A35', marginBottom: 8 },
  texto: { fontSize: 15, color: '#304A44', textAlign: 'center' },
});
