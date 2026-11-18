import React, { useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import DateTimeField from '../components/DateTimeField';
import { showMessage } from '../utils/dialogs';
import { insertEvent, getEventos, generateEventId, type NuevoEvento } from '../database/eventQueries';
import { useSync } from '../providers/SyncProvider';

export default function CreateEventScreen({ onClose }: { onClose?: () => void }) {
  const db = useSQLiteContext();
  const { requestSync } = useSync();

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

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatFecha = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const formatHora = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const onDateInicioChange = (selectedDate: Date) => {
    setDateInicioObj(selectedDate);
    setTextFechaInicio(formatFecha(selectedDate));
  };

  const onDateFinChange = (selectedDate: Date) => {
    setDateFinObj(selectedDate);
    setTextFechaFin(formatFecha(selectedDate));
  };

  const onStartTimeChange = (selectedTime: Date) => {
    setStartTimeObj(selectedTime);
    setTextHoraInicio(formatHora(selectedTime));
  };

  const onEndTimeChange = (selectedTime: Date) => {
    setEndTimeObj(selectedTime);
    setTextHoraFin(formatHora(selectedTime));
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
      showMessage('Campos incompletos', 'Por favor, rellena el título y la ubicación.');
      return;
    }

    const startDateTime = parseDateTimeToISO(textFechaInicio, textHoraInicio);
    const endDateTime = parseDateTimeToISO(textFechaFin, textHoraFin);

    if (!startDateTime || !endDateTime) {
      showMessage('Formato incorrecto', 'Usa el formato DD/MM/YYYY para la fecha y HH:MM para la hora.');
      return;
    }

    if (startDateTime >= endDateTime) {
      showMessage('Error de horario', 'La fecha y hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const nuevoEvento: NuevoEvento = {
      id: generateEventId(),
      titulo: titulo.trim(),
      fecha_inicio: startDateTime.toISOString(),
      fecha_fin: endDateTime.toISOString(),
      ubicacion: ubicacion.trim(),
      // Aquí aplicamos la limpieza de la descripción:
      descripcion: descripcion.trim().replace(/\n+/g, ' - ') || null,
    };

    try {
      await insertEvent(db, nuevoEvento);
      requestSync();

      const eventosEnBaseDeDatos = await getEventos(db);
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

      showMessage('Éxito', 'Evento guardado correctamente.');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      showMessage('Error', 'Hubo un problema al guardar el evento.');
    }
  };

  return (
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

        <DateTimeField
          label="Fecha de inicio *"
          mode="date"
          value={dateInicioObj}
          displayText={textFechaInicio}
          open={showPickerFechaInicio}
          onOpen={abrirFechaInicio}
          onClose={() => setShowPickerFechaInicio(false)}
          onChange={onDateInicioChange}
        />

        <DateTimeField
          label="Fecha de fin *"
          mode="date"
          value={dateFinObj}
          displayText={textFechaFin}
          open={showPickerFechaFin}
          onOpen={abrirFechaFin}
          onClose={() => setShowPickerFechaFin(false)}
          onChange={onDateFinChange}
        />

        <DateTimeField
          label="Hora de inicio *"
          mode="time"
          value={startTimeObj}
          displayText={textHoraInicio}
          open={showPickerHoraInicio}
          onOpen={abrirHoraInicio}
          onClose={() => setShowPickerHoraInicio(false)}
          onChange={onStartTimeChange}
        />

        <DateTimeField
          label="Hora de fin *"
          mode="time"
          value={endTimeObj}
          displayText={textHoraFin}
          open={showPickerHoraFin}
          onOpen={abrirHoraFin}
          onClose={() => setShowPickerHoraFin(false)}
          onChange={onEndTimeChange}
        />

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