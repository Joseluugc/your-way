/**
 * Reglas puras para identificar y clasificar tags NFC (Spec 02, US-02.2).
 * TypeScript puro: no depende de React Native ni de Expo.
 */

export type NfcTagType = 'USER_WRISTBAND' | 'STAND_POINT' | 'ZONE_CHECKPOINT';

/** Fila de `nfc_tags` tal y como se lee de SQLite. */
export interface NfcTagRow {
  uid: string;
  type: NfcTagType;
  user_id: string | null;
  stand_id: string | null;
  zone_id: string | null;
}

/** Lo que devuelve el lector físico, ya sin tipos de la librería nativa. */
export interface NfcRawTag {
  /** UID físico tal y como lo da la plataforma (hex, con o sin separadores). */
  id: string | null;
  techTypes: string[];
  /** Textos de los registros NDEF de tipo texto o URI, ya decodificados. */
  ndefTexts: string[];
}

export type TagIdSource = 'HARDWARE' | 'NDEF';

export interface TagIdentity {
  uid: string;
  source: TagIdSource;
}

export type TagResolution =
  | { kind: 'USER_WRISTBAND'; uid: string; userId: string }
  | { kind: 'STAND_POINT'; uid: string; standId: string }
  | { kind: 'ZONE_CHECKPOINT'; uid: string; zoneId: string }
  | { kind: 'UNKNOWN'; uid: string }
  /** La fila existe pero le falta la clave que exige su `type`. */
  | { kind: 'INCONSISTENT'; uid: string };

/** Prefijo del registro NDEF de Your Way: `yourway:w:<uid>`. */
export const YOUR_WAY_NDEF_PREFIX = 'yourway:w:';

/** Los UID de NFC-A miden 4, 7 o 10 bytes; NFC-V/ISO 15693, 8 bytes. */
const VALID_UID_BYTE_LENGTHS = new Set([4, 7, 8, 10]);

/**
 * Normaliza un UID físico: hexadecimal en mayúsculas, sin separadores.
 * Devuelve `null` si no es un UID válido.
 */
export function normalizeTagUid(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const hex = raw.replace(/[\s:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  return VALID_UID_BYTE_LENGTHS.has(hex.length / 2) ? hex : null;
}

/** Extrae el UID de un texto NDEF `yourway:w:<uid>`, o `null` si no es de Your Way. */
export function parseYourWayNdef(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith(YOUR_WAY_NDEF_PREFIX)) {
    return null;
  }
  return normalizeTagUid(trimmed.slice(YOUR_WAY_NDEF_PREFIX.length));
}

/** Codifica el texto del registro NDEF de Your Way para un UID ya normalizado. */
export function encodeYourWayNdef(uid: string): string {
  return `${YOUR_WAY_NDEF_PREFIX}${uid}`;
}

/**
 * Decide el identificador del tag: el UID físico si existe; si no (p. ej. iOS
 * con una sesión solo NDEF), el registro NDEF de Your Way.
 */
export function identifyTag(tag: NfcRawTag): TagIdentity | null {
  const hardwareUid = normalizeTagUid(tag.id);
  if (hardwareUid) {
    return { uid: hardwareUid, source: 'HARDWARE' };
  }
  for (const text of tag.ndefTexts) {
    const ndefUid = parseYourWayNdef(text);
    if (ndefUid) {
      return { uid: ndefUid, source: 'NDEF' };
    }
  }
  return null;
}

/** Clasifica un tag según su fila en `nfc_tags` (o su ausencia). */
export function resolveTag(uid: string, row: NfcTagRow | null): TagResolution {
  if (!row) {
    return { kind: 'UNKNOWN', uid };
  }
  switch (row.type) {
    case 'USER_WRISTBAND':
      return row.user_id
        ? { kind: 'USER_WRISTBAND', uid, userId: row.user_id }
        : { kind: 'INCONSISTENT', uid };
    case 'STAND_POINT':
      return row.stand_id
        ? { kind: 'STAND_POINT', uid, standId: row.stand_id }
        : { kind: 'INCONSISTENT', uid };
    case 'ZONE_CHECKPOINT':
      return row.zone_id
        ? { kind: 'ZONE_CHECKPOINT', uid, zoneId: row.zone_id }
        : { kind: 'INCONSISTENT', uid };
    default:
      return { kind: 'INCONSISTENT', uid };
  }
}
