import { describe, expect, it } from '@jest/globals';
import { contrastRatio, parseColor } from '../../src/domain/accessibility/contrast';
import type { OccupancyLevel } from '../../src/domain/map/mapTypes';
import { OCCUPANCY_STATUS } from '../../src/domain/map/occupancyStatus';

/**
 * Simulación de daltonismo de Machado, Oliveira y Fernandes (2009), severidad máxima,
 * aplicada en RGB lineal. Es la misma familia de modelos que usa Chrome DevTools.
 */
const MATRICES = {
  protanopía: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopía: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopía: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (linear: number) => {
  const clamped = Math.min(Math.max(linear, 0), 1);
  const value = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(value * 255);
};

function simulate(color: string, matrix: readonly (readonly number[])[]): string {
  const { r, g, b } = parseColor(color);
  const linear = [toLinear(r), toLinear(g), toLinear(b)];
  const channels = matrix.map((row) => toSrgb(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const LEVELS = Object.keys(OCCUPANCY_STATUS) as OccupancyLevel[];

describe('[US-06.3] semáforo de aforo con daltonismo', () => {
  it('[US-06.3] los textos son los acordados para cada nivel', () => {
    expect(LEVELS.map((level) => OCCUPANCY_STATUS[level].label)).toEqual([
      'Disponible',
      'Ocupación media',
      'Completo',
      'Sin datos',
    ]);
  });

  it('[US-06.3] cada nivel tiene un icono y un texto propios: se distingue sin ver colores', () => {
    expect(new Set(LEVELS.map((level) => OCCUPANCY_STATUS[level].icon)).size).toBe(4);
    expect(new Set(LEVELS.map((level) => OCCUPANCY_STATUS[level].label)).size).toBe(4);
  });

  it.each(Object.entries(MATRICES))(
    '[US-06.3] con %s el icono blanco sigue siendo legible sobre cada color (≥ 3:1)',
    (_type, matrix) => {
      for (const level of LEVELS) {
        const simulated = simulate(OCCUPANCY_STATUS[level].color, matrix);
        expect({ level, ratio: contrastRatio('#FFFFFF', simulated) >= 3 }).toEqual({ level, ratio: true });
      }
    },
  );

  it('[US-06.3] la simulación conserva blanco y negro (comprobación del modelo)', () => {
    for (const matrix of Object.values(MATRICES)) {
      expect(simulate('#FFFFFF', matrix)).toBe('#ffffff');
      expect(simulate('#000000', matrix)).toBe('#000000');
    }
  });
});
