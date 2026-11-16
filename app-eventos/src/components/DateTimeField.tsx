import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { showMessage } from '../utils/dialogs';

type Mode = 'date' | 'time';

interface DateTimeFieldProps {
  label: string;
  mode: Mode;
  value: Date;
  /** Texto mostrado en el campo (DD/MM/YYYY o HH:MM). */
  displayText: string;
  /** Solo iOS: si el selector en línea está desplegado. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: Date) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Valor en el formato que espera <input type="date|time"> en web. */
function toWebValue(date: Date, mode: Mode): string {
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromWebValue(raw: string, mode: Mode, base: Date): Date | null {
  if (!raw) return null;
  const result = new Date(base);
  if (mode === 'date') {
    const [y, m, d] = raw.split('-').map(Number);
    if (!y || !m || !d) return null;
    result.setFullYear(y, m - 1, d);
  } else {
    const [h, min] = raw.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    result.setHours(h, min, 0, 0);
  }
  return result;
}

function reportPickerError(error: unknown) {
  console.error('Error al abrir el selector de fecha/hora:', error);
  showMessage('Error', 'No se pudo abrir el selector de fecha/hora.');
}

/**
 * Campo de fecha u hora multiplataforma:
 * - Android: diálogo nativo abierto de forma imperativa (API recomendada por la librería).
 * - iOS: selector en línea que se despliega bajo el campo.
 * - Web: <input type="date|time"> del navegador (la librería nativa no soporta web).
 */
export default function DateTimeField({
  label,
  mode,
  value,
  displayText,
  open,
  onOpen,
  onClose,
  onChange,
}: DateTimeFieldProps) {
  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: mode,
          value: toWebValue(value, mode),
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => {
            const next = fromWebValue(event.target.value, mode, value);
            if (next) onChange(next);
          },
          style: webInputStyle,
        })}
      </View>
    );
  }

  const handlePress = () => {
    if (Platform.OS === 'android') {
      try {
        DateTimePickerAndroid.open({
          value,
          mode,
          is24Hour: true,
          onValueChange: (_event, selected) => onChange(selected),
          onDismiss: onClose,
          onError: reportPickerError,
        });
      } catch (error) {
        reportPickerError(error);
      }
      return;
    }
    if (open) {
      onClose();
    } else {
      onOpen();
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayText}`}
        style={({ pressed }) => [styles.input, pressed && styles.inputPressed]}
      >
        <Text style={styles.inputText}>{displayText}</Text>
      </Pressable>

      {Platform.OS === 'ios' && open && (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={value}
            mode={mode}
            is24Hour
            locale="es-ES"
            display={mode === 'date' ? 'inline' : 'spinner'}
            themeVariant="light"
            onValueChange={(_event, selected) => onChange(selected)}
          />
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneText}>Listo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6, fontWeight: '600', color: '#304A44' },
  input: {
    borderWidth: 1,
    borderColor: '#DFE7E3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#F8FAF9',
  },
  inputPressed: { borderColor: '#167B71' },
  inputText: { fontSize: 15, color: '#173A35' },
  iosPicker: {
    marginTop: -8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DFE7E3',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  doneButton: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 },
  doneText: { color: '#167B71', fontSize: 15, fontWeight: '700' },
});

const webInputStyle = {
  boxSizing: 'border-box',
  width: '100%',
  border: '1px solid #DFE7E3',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  fontSize: 15,
  backgroundColor: '#F8FAF9',
  color: '#173A35',
  fontFamily: 'inherit',
};
