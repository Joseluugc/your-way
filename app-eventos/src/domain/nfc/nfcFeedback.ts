/**
 * Respuesta a una lectura NFC (Spec 06, US-06.3): patrón háptico y mensaje para pantalla y
 * lector de pantalla. Lógica pura, sin dependencias de React Native ni de Expo.
 *
 * La vibración nunca es el único aviso: cada resultado tiene también un texto visible y
 * un anuncio para el lector de pantalla (los usa `useNfcFeedback`).
 */

/** Resultado de procesar una lectura NFC. */
export type NfcReadResult = 'SUCCESS' | 'ACCESS_DENIED' | 'READ_ERROR';

/**
 * Patrón háptico de notificación. Los valores coinciden con `NotificationFeedbackType` de
 * `expo-haptics` (success, warning, error); el adaptador hace la conversión explícita.
 */
export type HapticPattern = 'success' | 'warning' | 'error';

export interface NfcFeedback {
  result: NfcReadResult;
  haptic: HapticPattern;
  /** Icono visible, distinto por resultado (no depende del color). */
  icon: string;
  title: string;
  message: string;
  /** Texto completo que se anuncia al lector de pantalla. */
  announcement: string;
}

const HAPTIC_BY_RESULT: Record<NfcReadResult, HapticPattern> = {
  SUCCESS: 'success',
  ACCESS_DENIED: 'error',
  READ_ERROR: 'warning',
};

const TEXT_BY_RESULT: Record<NfcReadResult, { icon: string; title: string; message: string }> = {
  SUCCESS: { icon: '✓', title: 'Lectura correcta', message: 'La pulsera se ha leído correctamente.' },
  ACCESS_DENIED: {
    icon: '✕',
    title: 'Acceso denegado',
    message: 'Esta pulsera no tiene permiso para entrar en esta zona.',
  },
  READ_ERROR: {
    icon: '!',
    title: 'Error de lectura',
    message: 'No se pudo leer la pulsera. Acércala de nuevo al móvil.',
  },
};

/** Patrón háptico de cada resultado: éxito, error (acceso denegado) o aviso (fallo de lectura). */
export function getHapticPattern(result: NfcReadResult): HapticPattern {
  return HAPTIC_BY_RESULT[result];
}

/**
 * Respuesta completa a una lectura. `detail` añade contexto al mensaje (p. ej. el nombre
 * del asistente o de la zona).
 */
export function getNfcFeedback(result: NfcReadResult, detail?: string): NfcFeedback {
  const text = TEXT_BY_RESULT[result];
  const message = detail ? `${text.message} ${detail}` : text.message;
  return {
    result,
    haptic: getHapticPattern(result),
    icon: text.icon,
    title: text.title,
    message,
    announcement: `${text.title}. ${message}`,
  };
}
