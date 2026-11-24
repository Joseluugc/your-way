import type { NfcRawTag } from './nfcTag.ts';

/** Estado del lector del dispositivo (Spec 02, US-02.1). */
export type NfcAvailability = 'UNSUPPORTED' | 'DISABLED' | 'READY';

export type NfcReadFailureReason = 'CANCELLED' | 'TIMEOUT' | 'UNSUPPORTED' | 'FAILED';

/** Error de lectura sin tipos de la librería nativa. */
export class NfcReadError extends Error {
  readonly reason: NfcReadFailureReason;

  constructor(reason: NfcReadFailureReason, message: string) {
    super(message);
    this.name = 'NfcReadError';
    this.reason = reason;
  }
}

/** Puerto del lector NFC. Lo implementan el adaptador nativo y el simulado. */
export interface NfcReaderPort {
  getAvailability(): Promise<NfcAvailability>;
  /** Abre una sesión, espera un tag y la cierra. Rechaza con `NfcReadError`. */
  readTag(): Promise<NfcRawTag>;
  /** Cancela la sesión en curso, si la hay. */
  cancel(): Promise<void>;
  /** Abre los ajustes de NFC del sistema (solo Android). */
  openSettings(): Promise<void>;
}
