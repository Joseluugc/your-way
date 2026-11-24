import { describe, expect, it } from '@jest/globals';
import {
  contrastRatio,
  isLargeText,
  meetsWcagAA,
  parseColor,
  relativeLuminance,
} from '../../src/domain/accessibility/contrast';
import { OCCUPANCY_STATUS } from '../../src/domain/map/occupancyStatus';

describe('[US-06.3] contraste WCAG 2.1 (función de dominio)', () => {
  it('[US-06.3] negro sobre blanco es 21:1 y un color sobre sí mismo 1:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#13695F', '#13695F')).toBeCloseTo(1, 5);
  });

  it('[US-06.3] coincide con valores de referencia', () => {
    // #767676 es el gris más claro que cumple 4,5:1 sobre blanco.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('[US-06.3] acepta #RGB, #RRGGBB, rgb() y rgba() opaco', () => {
    expect(parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('13695f')).toEqual({ r: 19, g: 105, b: 95 });
    expect(parseColor('rgb(19, 105, 95)')).toEqual({ r: 19, g: 105, b: 95 });
    expect(parseColor('rgba(19,105,95,1)')).toEqual({ r: 19, g: 105, b: 95 });
  });

  it('[US-06.3] rechaza colores con transparencia o no válidos', () => {
    expect(() => parseColor('rgba(0, 0, 0, 0.5)')).toThrow();
    expect(() => parseColor('transparent')).toThrow();
    expect(() => parseColor('#12345')).toThrow();
    expect(() => parseColor('rgb(300, 0, 0)')).toThrow();
  });

  it('[US-06.3] texto grande: ≥ 18 pt (24 px) o ≥ 14 pt (18,67 px) en negrita', () => {
    expect(isLargeText(24)).toBe(true);
    expect(isLargeText(23)).toBe(false);
    expect(isLargeText(19, '700')).toBe(true);
    expect(isLargeText(19, 'bold')).toBe(true);
    expect(isLargeText(18, 'bold')).toBe(false);
    expect(isLargeText(19, '600')).toBe(false);
  });

  it('[US-06.3] aplica 4,5:1 al texto normal y 3:1 al grande y a los iconos', () => {
    expect(meetsWcagAA('#777777', '#FFFFFF', 'text')).toBe(false);
    expect(meetsWcagAA('#777777', '#FFFFFF', 'largeText')).toBe(true);
    expect(meetsWcagAA('#777777', '#FFFFFF', 'nonText')).toBe(true);
    expect(meetsWcagAA('#7E8E88', '#FFFFFF', 'nonText')).toBe(true);
  });
});

/**
 * Colores del semáforo que no se pintan como `<Text>` (círculos SVG del plano), y por tanto
 * no los ve la auditoría de pantallas: icono blanco sobre el color y color sobre los fondos.
 */
describe('[US-06.3] contraste del semáforo de aforo', () => {
  const BACKGROUNDS = { tarjeta: '#FFFFFF', pantalla: '#F3F6F4', plano: '#FBFDFC' };

  it.each(Object.entries(OCCUPANCY_STATUS))(
    '[US-06.3] nivel %s: el icono blanco y el marcador se distinguen (≥ 3:1)',
    (_level, status) => {
      expect(contrastRatio('#FFFFFF', status.color)).toBeGreaterThanOrEqual(3);
      for (const background of Object.values(BACKGROUNDS)) {
        expect(contrastRatio(status.color, background)).toBeGreaterThanOrEqual(3);
      }
    },
  );
});
