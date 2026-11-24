import { Platform } from 'react-native';
import type { NdefRecord, TagEvent } from 'react-native-nfc-manager';
import {
  NfcReadError,
  type NfcAvailability,
  type NfcReaderPort,
} from '../domain/nfc/nfcReaderPort';
import type { NfcRawTag } from '../domain/nfc/nfcTag';

type NfcLibrary = typeof import('react-native-nfc-manager');

/** Tiempo máximo esperando un tag antes de cerrar la sesión (US-02.2). */
export const NFC_READ_TIMEOUT_MS = 30_000;

let libraryPromise: Promise<NfcLibrary | null> | null = null;

/**
 * Carga la librería de forma diferida: al importarse lanza un error si el
 * módulo nativo no existe (Expo Go, web o sin development build).
 */
function loadLibrary(): Promise<NfcLibrary | null> {
  if (Platform.OS === 'web') {
    return Promise.resolve(null);
  }
  libraryPromise ??= import('react-native-nfc-manager').catch((error: unknown) => {
    console.warn('[NFC] Módulo nativo no disponible:', error);
    return null;
  });
  return libraryPromise;
}

function bytesEqual(type: NdefRecord['type'], expected: string): boolean {
  if (typeof type === 'string') {
    return type === expected;
  }
  return String.fromCharCode(...type) === expected;
}

/** Decodifica los registros NDEF de texto y URI; ignora el resto. */
function decodeNdefTexts(library: NfcLibrary, records: NdefRecord[] | undefined): string[] {
  const { Ndef } = library;
  const texts: string[] = [];
  for (const record of records ?? []) {
    if (record.tnf !== Ndef.TNF_WELL_KNOWN) {
      continue;
    }
    try {
      const payload = Uint8Array.from(record.payload);
      if (bytesEqual(record.type, Ndef.RTD_TEXT)) {
        texts.push(Ndef.text.decodePayload(payload));
      } else if (bytesEqual(record.type, Ndef.RTD_URI)) {
        texts.push(Ndef.uri.decodePayload(payload));
      }
    } catch (error) {
      console.warn('[NFC] Registro NDEF ilegible:', error);
    }
  }
  return texts;
}

function toRawTag(library: NfcLibrary, tag: TagEvent): NfcRawTag {
  return {
    id: tag.id ?? null,
    techTypes: tag.techTypes ?? (tag.tech ? [tag.tech] : []),
    ndefTexts: decodeNdefTexts(library, tag.ndefMessage),
  };
}

function toReadError(library: NfcLibrary, error: unknown, timedOut: boolean): NfcReadError {
  if (timedOut || error instanceof library.NfcError.Timeout) {
    return new NfcReadError('TIMEOUT', 'No se ha detectado ningún tag.');
  }
  if (error instanceof library.NfcError.UserCancel) {
    return new NfcReadError('CANCELLED', 'Lectura cancelada.');
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new NfcReadError('FAILED', `No se ha podido leer el tag: ${detail}`);
}

/** Adaptador de `NfcReaderPort` sobre `react-native-nfc-manager`. */
export function createNfcManagerReader(): NfcReaderPort {
  let started = false;
  let reading = false;
  let cancelledByUser = false;

  async function ensureStarted(library: NfcLibrary): Promise<void> {
    if (!started) {
      await library.default.start();
      started = true;
    }
  }

  return {
    async getAvailability(): Promise<NfcAvailability> {
      const library = await loadLibrary();
      if (!library) {
        return 'UNSUPPORTED';
      }
      try {
        if (!(await library.default.isSupported())) {
          return 'UNSUPPORTED';
        }
        await ensureStarted(library);
        return (await library.default.isEnabled()) ? 'READY' : 'DISABLED';
      } catch (error) {
        console.warn('[NFC] No se ha podido comprobar el lector:', error);
        return 'UNSUPPORTED';
      }
    },

    async readTag(): Promise<NfcRawTag> {
      const library = await loadLibrary();
      if (!library) {
        throw new NfcReadError('UNSUPPORTED', 'Este dispositivo no puede leer NFC.');
      }
      if (reading) {
        throw new NfcReadError('FAILED', 'Ya hay una lectura en curso.');
      }
      reading = true;
      cancelledByUser = false;
      let timedOut = false;
      const manager = library.default;
      const timer = setTimeout(() => {
        timedOut = true;
        void manager.cancelTechnologyRequest();
      }, NFC_READ_TIMEOUT_MS);

      try {
        await ensureStarted(library);
        // NfcA primero: en iOS se traduce a MIFARE y da acceso al UID físico.
        await manager.requestTechnology([library.NfcTech.NfcA, library.NfcTech.Ndef], {
          alertMessage: 'Acerca la pulsera o el punto NFC a la parte superior del móvil.',
        });
        const tag = await manager.getTag();
        if (!tag) {
          throw new NfcReadError('FAILED', 'El tag se retiró antes de leerlo.');
        }
        if (Platform.OS === 'ios') {
          await manager.setAlertMessageIOS('Tag leído');
        }
        return toRawTag(library, tag);
      } catch (error) {
        if (error instanceof NfcReadError) {
          throw error;
        }
        if (cancelledByUser) {
          throw new NfcReadError('CANCELLED', 'Lectura cancelada.');
        }
        throw toReadError(library, error, timedOut);
      } finally {
        clearTimeout(timer);
        await manager.cancelTechnologyRequest().catch(() => undefined);
        reading = false;
      }
    },

    async cancel(): Promise<void> {
      const library = await loadLibrary();
      if (!library || !reading) {
        return;
      }
      cancelledByUser = true;
      await library.default.cancelTechnologyRequest().catch(() => undefined);
    },

    async openSettings(): Promise<void> {
      const library = await loadLibrary();
      if (library && Platform.OS === 'android') {
        await library.default.goToNfcSetting();
      }
    },
  };
}
