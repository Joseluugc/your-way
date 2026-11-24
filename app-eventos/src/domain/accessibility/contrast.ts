/**
 * Contraste de color según WCAG 2.1 (Spec 06, US-06.3). Sin dependencias de React Native.
 *
 * - Relación de contraste: (L1 + 0,05) / (L2 + 0,05), con L la luminancia relativa.
 * - 1.4.3 (AA): texto normal ≥ 4,5:1; texto grande ≥ 3:1.
 * - 1.4.11 (AA): iconos y bordes de controles ≥ 3:1.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Texto normal (1.4.3), texto grande (1.4.3) o componente no textual (1.4.11). */
export type ContrastUse = 'text' | 'largeText' | 'nonText';

export const WCAG_AA_MINIMUM: Record<ContrastUse, number> = {
  text: 4.5,
  largeText: 3,
  nonText: 3,
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0+|0?\.\d+|0))?\s*\)$/i;

/**
 * Convierte `#RGB`, `#RRGGBB`, `rgb(r, g, b)` o `rgba(r, g, b, 1)` a RGB.
 * Un color con transparencia no tiene un contraste definido por sí solo: se rechaza.
 */
export function parseColor(color: string): Rgb {
  const trimmed = color.trim();
  const hex = HEX.exec(trimmed);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
    };
  }

  const rgb = RGB.exec(trimmed);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (alpha === 1 && [r, g, b].every((channel) => channel <= 255)) {
      return { r, g, b };
    }
  }

  throw new Error(`Color no válido o con transparencia: ${color}`);
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG 2.1 (0 = negro, 1 = blanco). */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseColor(color);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Relación de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Texto grande según WCAG: ≥ 18 pt, o ≥ 14 pt en negrita.
 * En React Native el tamaño va en dp, equivalentes a px CSS: 1 pt = 4/3 px.
 */
export function isLargeText(fontSize: number, fontWeight?: string | number): boolean {
  const bold = fontWeight === 'bold' || Number(fontWeight) >= 700;
  return fontSize >= (bold ? 14 : 18) * (4 / 3);
}

export function meetsWcagAA(foreground: string, background: string, use: ContrastUse): boolean {
  return contrastRatio(foreground, background) >= WCAG_AA_MINIMUM[use];
}
