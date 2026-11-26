import { describe, expect, it } from '@jest/globals';
import { getHapticPattern, getNfcFeedback, type NfcReadResult } from '../../src/domain/nfc/nfcFeedback';

describe('[US-06.3] patrones hápticos de las lecturas NFC', () => {
  it('[US-06.3] una lectura NFC correcta vibra con la notificación de éxito', () => {
    expect(getHapticPattern('SUCCESS')).toBe('success');
  });

  it('[US-06.3] un acceso denegado vibra con la notificación de error', () => {
    expect(getHapticPattern('ACCESS_DENIED')).toBe('error');
  });

  it('[US-06.3] un error de lectura vibra con la notificación de aviso', () => {
    expect(getHapticPattern('READ_ERROR')).toBe('warning');
  });

  it('[US-06.3] los tres resultados tienen patrones distintos', () => {
    const results: NfcReadResult[] = ['SUCCESS', 'ACCESS_DENIED', 'READ_ERROR'];
    expect(new Set(results.map(getHapticPattern)).size).toBe(3);
  });
});

describe('[US-06.3] la vibración nunca es el único aviso', () => {
  it.each([
    ['SUCCESS', 'Lectura correcta', '✓'],
    ['ACCESS_DENIED', 'Acceso denegado', '✕'],
    ['READ_ERROR', 'Error de lectura', '!'],
  ] as const)('[US-06.3] %s tiene título "%s", icono %s y anuncio hablado', (result, title, icon) => {
    const feedback = getNfcFeedback(result);

    expect(feedback.title).toBe(title);
    expect(feedback.icon).toBe(icon);
    expect(feedback.message.length).toBeGreaterThan(0);
    expect(feedback.announcement).toBe(`${title}. ${feedback.message}`);
    expect(feedback.haptic).toBe(getHapticPattern(result));
  });

  it('[US-06.3] el detalle se añade al mensaje y al anuncio', () => {
    const feedback = getNfcFeedback('ACCESS_DENIED', 'Zona: Backstage Staff.');

    expect(feedback.message).toMatch(/Zona: Backstage Staff\.$/);
    expect(feedback.announcement).toMatch(/^Acceso denegado\. .*Zona: Backstage Staff\.$/);
  });
});
