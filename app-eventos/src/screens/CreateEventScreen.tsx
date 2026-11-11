import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import DateTimePicker from '@react-native-community/datetimepicker';
import { insertEvent, getEventos } from '../database/eventQueries';

export default function CreateEventScreen({ onClose }: { onClose?: () => void }) {
  const db = useSQLiteContext();

  const [titulo, setTitulo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [textFechaInicio, setTextFechaInicio] = useState('15/11/2026');
  const [textFechaFin, setTextFechaFin] = useState('15/11/2026');
  const [textHoraInicio, setTextHoraInicio] = useState('10:00');
  const [textHoraFin, setTextHoraFin] = useState('12:00');

  const [dateInicioObj, setDateInicioObj] = useState(new Date(2026, 10, 15, 10, 0));
  const [dateFinObj, setDateFinObj] = useState(new Date(2026, 10, 15, 12, 0));
  const [startTimeObj, setStartTimeObj] = useState(new Date(2026, 10, 15, 10, 0));
  const [endTimeObj, setEndTimeObj] = useState(new Date(2026, 10, 15, 12, 0));

  const [showPickerFechaInicio, setShowPickerFechaInicio] = useState(false);
  const [showPickerFechaFin, setShowPickerFechaFin] = useState(false);
  const [showPickerHoraInicio, setShowPickerHoraInicio] = useState(false);
  const [showPickerHoraFin, setShowPickerHoraFin] = useState(false);

  const cerrarTodosLosPickers = () => {
    setShowPickerFechaInicio(false);
    setShowPickerFechaFin(false);
    setShowPickerHoraInicio(false);
    setShowPickerHoraFin(false);
  };

  const abrirFechaInicio = () => {
    setShowPickerFechaInicio(true);
    setShowPickerFechaFin(false);
    setShowPickerHoraInicio(false);
    setShowPickerHoraFin(false);
  };

  const abrirFechaFin = () => {
    setShowPickerFechaFin(true);
    setShowPickerFechaInicio(false);
    setShowPickerHoraInicio(false);
    setShowPickerHoraFin(false);
  };

  const abrirHoraInicio = () => {
    setShowPickerHoraInicio(true);
    setShowPickerFechaInicio(false);
    setShowPickerFechaFin(false);
    setShowPickerHoraFin(false);
  };

  const abrirHoraFin = () => {
    setShowPickerHoraFin(true);
    setShowPickerFechaInicio(false);
    setShowPickerFechaFin(false);
    setShowPickerHoraInicio(false);
  };

  const onDateInicioChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPickerFechaInicio(false);
    if (selectedDate) {
      setDateInicioObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      setTextFechaInicio(`${day}/${month}/${year}`); } };  const onDateFinChange = (event: any, selectedDate?: Date) => { if (Platform.OS === 'android') setShowPickerFechaFin(false); if (selectedDate) { setDateFinObj(selectedDate); const day = String(selectedDate.getDate()).padStart(2, '0'); const month = String(selectedDate.getMonth() + 1).padStart(2, '0'); const year = selectedDate.getFullYear(); setTextFechaFin(`${day}/${month}/${year}`);
    }
  };

  const onStartTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') setShowPickerHoraInicio(false);
    if (selectedTime) {
      setStartTimeObj(selectedTime);
      const hours = String(selectedTime.getHours()).padStart(2, '0');
      const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
      setTextHoraInicio(`${hours}:${minutes}`);
    }
  };

  const onEndTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') setShowPickerHoraFin(false);
    if (selectedTime) {
      setEndTimeObj(selectedTime);
      const hours = String(selectedTime.getHours()).padStart(2, '0');
      const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
      setTextHoraFin(`${hours}:${minutes}`);
    }
  };

  const parseDateTimeToISO = (dateStr: string, timeStr: string) => {
    const [d, m, y] = dateStr.split('/').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    if (!d || !m || !y || h === undefined || min === undefined) return null;
    return new Date(y, m - 1, d, h, min, 0);
  };

  const handleGuardarEvento = async () => {
    cerrarTodosLosPickers();
    if (!titulo.trim() || !ubicacion.trim()) {
      Alert.alert('Campos incompletos', 'Por favor, rellena el título y la ubicación.');
      return;
    }

    const startDateTime = parseDateTimeToISO(textFechaInicio, textHoraInicio);
    const endDateTime = parseDateTimeToISO(textFechaFin, textHoraFin);

    if (!startDateTime || !endDateTime) {
      Alert.alert('Formato incorrecto', 'Usa el formato DD/MM/YYYY para la fecha y HH:MM para la hora.');
      return;
    }

    if (startDateTime >= endDateTime) {
      Alert.alert('Error de horario', 'La fecha y hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const nuevoEvento = {
      id: Date.now().toString(),
      titulo: titulo.trim(),
      fecha_inicio: startDateTime.toISOString(),
      fecha_fin: endDateTime.toISOString(),
      ubicacion: ubicacion.trim(),
      // Aquí aplicamos la limpieza de la descripción:
      descripcion: descripcion.trim().replace(/\n+/g, ' - '), 
    };

    try {
      await insertEvent(db, nuevoEvento);

      const eventosEnBaseDeDatos = await getEventos(db) as any[];
      console.log('\n--- BBDD ACTUALIZADA: TABLA EVENTOS ---');
      
      const eventosFormateados = eventosEnBaseDeDatos.map((ev) => {
        const inicio = new Date(ev.fecha_inicio);
        const fin = new Date(ev.fecha_fin);

        const fechaInicioStr = inicio.toLocaleDateString('es-ES');
        const fechaFinStr = fin.toLocaleDateString('es-ES');
        
        const horaInicioStr = inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const horaFinStr = fin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const fechaFormateada = fechaInicioStr === fechaFinStr 
          ? fechaInicioStr 
          : `Desde el ${fechaInicioStr} hasta el ${fechaFinStr}`;

        return {
          id: ev.id,
          titulo: ev.titulo,
          Fecha: fechaFormateada,
          Hora: `Desde las ${horaInicioStr} hasta las ${horaFinStr}`,
          ubicacion: ev.ubicacion,
          descripcion: ev.descripcion,
        };
      });

      console.log(JSON.stringify(eventosFormateados, null, 2));
      console.log('---------------------------------------\n');

      Alert.alert('Éxito', 'Evento guardado correctamente.');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'Hubo un problema al guardar el evento.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={cerrarTodosLosPickers}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionHeader}>Información General</Text>

        <Text style={styles.label}>Título del evento *</Text>
        <TextInput
          style={styles.input}
          value={titulo}
          onChangeText={setTitulo}
          onFocus={cerrarTodosLosPickers}
          placeholder="Ej. Conferencia Tech"
          placeholderTextColor="#91A19B"
        />

        <Text style={styles.label}>Fecha de inicio *</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={abrirFechaInicio}>
          <View pointerEvents="none">
            <TextInput style={styles.input} value={textFechaInicio} placeholder="DD/MM/YYYY" placeholderTextColor="#91A19B" />
          </View>
        </TouchableOpacity>
        {showPickerFechaInicio && <DateTimePicker value={dateInicioObj} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateInicioChange} />}

        <Text style={styles.label}>Fecha de fin *</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={abrirFechaFin}>
          <View pointerEvents="none">
            <TextInput style={styles.input} value={textFechaFin} placeholder="DD/MM/YYYY" placeholderTextColor="#91A19B" />
          </View>
        </TouchableOpacity>
        {showPickerFechaFin && <DateTimePicker value={dateFinObj} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateFinChange} />}

        <Text style={styles.label}>Hora de inicio *</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={abrirHoraInicio}>
          <View pointerEvents="none">
            <TextInput style={styles.input} value={textHoraInicio} placeholder="HH:MM" placeholderTextColor="#91A19B" />
          </View>
        </TouchableOpacity>
        {showPickerHoraInicio && <DateTimePicker value={startTimeObj} mode="time" is24Hour={true} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartTimeChange} />}

        <Text style={styles.label}>Hora de fin *</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={abrirHoraFin}>
          <View pointerEvents="none">
            <TextInput style={styles.input} value={textHoraFin} placeholder="HH:MM" placeholderTextColor="#91A19B" />
          </View>
        </TouchableOpacity>
        {showPickerHoraFin && <DateTimePicker value={endTimeObj} mode="time" is24Hour={true} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onEndTimeChange} />}

        <Text style={styles.sectionHeader}>Ubicación y Detalles</Text>

        <Text style={styles.label}>Ubicación *</Text>
        <TextInput
          style={styles.input}
          value={ubicacion}
          onChangeText={setUbicacion}
          onFocus={cerrarTodosLosPickers}
          placeholder="Ej. Auditorio Principal"
          placeholderTextColor="#91A19B"
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={descripcion}
          onChangeText={setDescripcion}
          onFocus={cerrarTodosLosPickers}
          placeholder="Añade detalles..."
          placeholderTextColor="#91A19B"
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleGuardarEvento} activeOpacity={0.8}>
          <Text style={styles.submitButtonText}>Guardar Evento</Text>
        </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FFFFFF', flexGrow: 1 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#173A35', marginTop: 6, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5EBE8', paddingBottom: 6 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '600', color: '#304A44' },
  input: { borderWidth: 1, borderColor: '#DFE7E3', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#F8FAF9', color: '#173A35' },
  textArea: { height: 90, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#167B71', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 20 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});