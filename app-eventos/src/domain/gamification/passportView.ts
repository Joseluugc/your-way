/**
 * View model de presentación del pasaporte de sellos (Spec 09).
 * Sin imports de React Native ni Expo: se testea con Node (`tests/passportView.test.mjs`).
 * `usePassport` (T031) y `toPassportViewData` (T080) rellenarán este contrato con datos reales.
 */

export type EstrellasValoracion = 1 | 2 | 3 | 4 | 5;

/** Una tarjeta por estand del evento. Una tarjeta bloqueada nunca lleva el nombre del estand. */
export type PassportStampCardData =
  | { estado: 'BLOQUEADO'; standId: string }
  | {
      estado: 'DESBLOQUEADO';
      standId: string;
      standName: string;
      scannedAt: string; // ISO 8601
      xpGanada: number;
      estrellas: EstrellasValoracion | null;
    };

export interface PassportViewData {
  /** XP total ya calculado (incluye trivia, valoraciones e insignias): la pantalla no lo suma. */
  xpTotal: number;
  sellos: PassportStampCardData[]; // un elemento por estand del evento
}

export interface ProgresoPasaporte {
  conseguidos: number;
  total: number;
  porcentaje: number; // 0..100, entero; 0 si total = 0
}

const MAX_ESTRELLAS = 5;

/** Sellos conseguidos sobre el total de estands del evento. */
export function calcularProgreso(sellos: readonly PassportStampCardData[]): ProgresoPasaporte {
  const total = sellos.length;
  const conseguidos = sellos.filter((sello) => sello.estado === 'DESBLOQUEADO').length;
  const porcentaje = total === 0 ? 0 : Math.round((conseguidos * 100) / total);
  return { conseguidos, total, porcentaje };
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Fecha del sello en hora local con formato `dd/MM HH:mm`. */
export function formatearFechaSello(iso: string): string {
  const fecha = new Date(iso);
  const dia = dosDigitos(fecha.getDate());
  const mes = dosDigitos(fecha.getMonth() + 1);
  const horas = dosDigitos(fecha.getHours());
  const minutos = dosDigitos(fecha.getMinutes());
  return `${dia}/${mes} ${horas}:${minutos}`;
}

/** Estrellas en texto, p. ej. «★★★★☆». */
export function formatearEstrellas(estrellas: EstrellasValoracion): string {
  return '★'.repeat(estrellas) + '☆'.repeat(MAX_ESTRELLAS - estrellas);
}

/**
 * Etiqueta para el lector de pantalla. `indice` empieza en 0.
 * Bloqueada: «Sello 2 de 8, bloqueado» (sin el nombre del estand).
 * Desbloqueada: «Sello 1 de 8, Estand Café, conseguido el 27/11 a las 10:32, 100 XP, 4 de 5 estrellas».
 */
export function etiquetaAccesibleSello(
  card: PassportStampCardData,
  indice: number,
  total: number,
): string {
  const posicion = `Sello ${indice + 1} de ${total}`;
  if (card.estado === 'BLOQUEADO') return `${posicion}, bloqueado`;

  const [dia, hora] = formatearFechaSello(card.scannedAt).split(' ');
  const valoracion =
    card.estrellas === null ? 'sin valorar' : `${card.estrellas} de ${MAX_ESTRELLAS} estrellas`;
  return `${posicion}, ${card.standName}, conseguido el ${dia} a las ${hora}, ${card.xpGanada} XP, ${valoracion}`;
}
