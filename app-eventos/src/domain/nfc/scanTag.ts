import { NfcReadError, type NfcReaderPort } from './nfcReaderPort.ts';
import {
  identifyTag,
  resolveTag,
  type NfcRawTag,
  type NfcTagRow,
  type TagIdSource,
  type TagResolution,
} from './nfcTag.ts';

/** Registro local de cada lectura (prueba de concepto de la Spec 02). */
export interface NfcScanRecord {
  id: string;
  uid: string | null;
  uidSource: TagIdSource | null;
  techTypes: string[];
  ndefTexts: string[];
  resolution: TagResolution['kind'] | 'UNREADABLE';
  durationMs: number;
  scannedAt: string;
}

/** Puerto de persistencia de tags. Lo implementa el repositorio SQLite. */
export interface NfcTagRepositoryPort {
  findTag(uid: string): Promise<NfcTagRow | null>;
  recordScan(record: NfcScanRecord): Promise<void>;
}

export type ScanOutcome =
  | { ok: true; resolution: TagResolution; record: NfcScanRecord }
  /** Se leyó algo, pero sin UID válido ni registro NDEF de Your Way. */
  | { ok: false; reason: 'UNREADABLE'; record: NfcScanRecord }
  | { ok: false; reason: NfcReadError['reason'] };

export interface ScanTagDependencies {
  reader: NfcReaderPort;
  repository: NfcTagRepositoryPort;
  now: () => Date;
  newId: () => string;
}

/**
 * Lee un tag, lo resuelve contra `nfc_tags` y guarda la lectura en local.
 * Nunca consulta la red: funciona igual sin conexión.
 */
export async function scanTag(deps: ScanTagDependencies): Promise<ScanOutcome> {
  let raw: NfcRawTag;
  try {
    raw = await deps.reader.readTag();
  } catch (error) {
    if (error instanceof NfcReadError) {
      return { ok: false, reason: error.reason };
    }
    return { ok: false, reason: 'FAILED' };
  }

  // El tiempo se mide desde la detección del tag hasta tenerlo resuelto y guardado.
  const detectedAt = deps.now();
  const identity = identifyTag(raw);
  const resolution = identity
    ? resolveTag(identity.uid, await deps.repository.findTag(identity.uid))
    : null;

  const record: NfcScanRecord = {
    id: deps.newId(),
    uid: identity?.uid ?? null,
    uidSource: identity?.source ?? null,
    techTypes: raw.techTypes,
    ndefTexts: raw.ndefTexts,
    resolution: resolution?.kind ?? 'UNREADABLE',
    durationMs: 0,
    scannedAt: detectedAt.toISOString(),
  };
  record.durationMs = Math.max(0, deps.now().getTime() - detectedAt.getTime());
  await deps.repository.recordScan(record);

  return resolution
    ? { ok: true, resolution, record }
    : { ok: false, reason: 'UNREADABLE', record };
}
