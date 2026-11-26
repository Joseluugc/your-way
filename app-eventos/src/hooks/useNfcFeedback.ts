import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getNfcFeedback, type NfcFeedback, type NfcReadResult } from '../domain/nfc/nfcFeedback';
import { playHaptic } from '../lib/haptics';

/**
 * Presenta el resultado de una lectura NFC por tres vías a la vez (Spec 06, US-06.3):
 * vibración (`expo-haptics`), aviso en pantalla (`feedback`, que pinta `NfcResultBanner`)
 * y anuncio al lector de pantalla. Es el único punto de entrada: la vibración nunca va sola.
 */
export function useNfcFeedback() {
  const [feedback, setFeedback] = useState<NfcFeedback | null>(null);

  const present = useCallback((result: NfcReadResult, detail?: string) => {
    const next = getNfcFeedback(result, detail);
    setFeedback(next);
    AccessibilityInfo.announceForAccessibility(next.announcement);
    void playHaptic(next.haptic);
    return next;
  }, []);

  const dismiss = useCallback(() => setFeedback(null), []);

  return { feedback, present, dismiss };
}
