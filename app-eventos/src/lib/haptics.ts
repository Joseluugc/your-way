import * as Haptics from 'expo-haptics';
import type { HapticPattern } from '../domain/nfc/nfcFeedback';

/** Conversión explícita del patrón de dominio al tipo de `expo-haptics` (SDK 58). */
const FEEDBACK_TYPE: Record<HapticPattern, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/**
 * Reproduce la vibración de notificación del patrón. Si el dispositivo no tiene motor
 * háptico (web, emulador) no falla: el aviso visual y el hablado siguen funcionando.
 */
export async function playHaptic(pattern: HapticPattern): Promise<void> {
  try {
    await Haptics.notificationAsync(FEEDBACK_TYPE[pattern]);
  } catch {
    // Sin vibración disponible: no es el único aviso, así que no se interrumpe nada.
  }
}
