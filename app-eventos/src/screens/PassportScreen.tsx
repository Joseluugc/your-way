import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import PassportHeader from '../components/PassportHeader';
import PassportStampCard from '../components/PassportStampCard';
import PassportStampDetailModal from '../components/PassportStampDetailModal';
import {
  ESCENARIO_POR_DEFECTO,
  ESCENARIOS_PASAPORTE,
  type EscenarioPasaporte,
} from '../domain/gamification/passportMockData';
import {
  calcularProgreso,
  type PassportStampCardData,
  type PassportViewData,
} from '../domain/gamification/passportView';

interface PassportViewProps {
  data: PassportViewData;
}

/**
 * Vista presentacional del pasaporte (Spec 09). Recibe sus datos por props: `usePassport`
 * (T031) sustituirá al mock sin cambiar este componente.
 */
export function PassportView({ data }: PassportViewProps) {
  const [seleccionado, setSeleccionado] = useState<PassportStampCardData | null>(null);
  const progreso = calcularProgreso(data.sellos);
  const sinEstands = progreso.total === 0;

  const cabecera = (
    <View>
      <PassportHeader xpTotal={data.xpTotal} progreso={progreso} />
      {!sinEstands && progreso.conseguidos === 0 ? (
        <Text style={styles.aviso}>Visita un estand y acerca tu móvil a su NFC para tu primer sello</Text>
      ) : null}
    </View>
  );

  if (sinEstands) {
    return (
      <View style={styles.contenedor}>
        <View style={styles.lista}>{cabecera}</View>
        <View style={styles.vacio}>
          <Text style={styles.textoVacio}>Este evento aún no tiene estands</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <FlatList
        data={data.sellos}
        keyExtractor={(sello) => sello.standId}
        numColumns={2}
        ListHeaderComponent={cabecera}
        contentContainerStyle={styles.lista}
        renderItem={({ item, index }) => (
          <PassportStampCard
            card={item}
            indice={index}
            total={progreso.total}
            onPress={setSeleccionado}
          />
        )}
      />
      <PassportStampDetailModal card={seleccionado} onClose={() => setSeleccionado(null)} />
    </View>
  );
}

const ESCENARIOS: EscenarioPasaporte[] = ['sinEstands', 'sinSellos', 'parcial', 'completo'];

/** Contenedor de la pestaña Pasaporte: de momento usa el mock (TASK-10). */
export default function PassportScreen() {
  const [escenario, setEscenario] = useState<EscenarioPasaporte>(ESCENARIO_POR_DEFECTO);

  return (
    <View style={styles.contenedor}>
      {__DEV__ ? (
        <View style={styles.selector} accessibilityLabel="Escenario de prueba del pasaporte">
          {ESCENARIOS.map((opcion) => {
            const activo = opcion === escenario;
            return (
              <Pressable
                key={opcion}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Escenario ${opcion}`}
                onPress={() => setEscenario(opcion)}
                style={[styles.opcion, activo && styles.opcionActiva]}
              >
                <Text style={[styles.textoOpcion, activo && styles.textoOpcionActiva]}>{opcion}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {/* `key` reinicia la ficha abierta al cambiar de escenario. */}
      <PassportView key={escenario} data={ESCENARIOS_PASAPORTE[escenario]} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  lista: { padding: 10 },
  aviso: { fontSize: 15, color: '#304A44', textAlign: 'center', marginHorizontal: 6, marginVertical: 8 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  textoVacio: { fontSize: 16, color: '#304A44', textAlign: 'center' },
  selector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE5E2',
  },
  opcion: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#13695F',
    justifyContent: 'center',
  },
  opcionActiva: { backgroundColor: '#13695F' },
  textoOpcion: { fontSize: 13, color: '#13695F' },
  textoOpcionActiva: { color: '#FFFFFF', fontWeight: '700' },
});
