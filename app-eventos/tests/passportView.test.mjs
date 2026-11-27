import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularProgreso,
  etiquetaAccesibleSello,
  formatearEstrellas,
  formatearFechaSello,
} from '../src/domain/gamification/passportView.ts';
import {
  ESCENARIO_POR_DEFECTO,
  ESCENARIOS_PASAPORTE,
} from '../src/domain/gamification/passportMockData.ts';

// Fecha construida en hora local: el resultado no depende de la zona horaria del equipo.
const FECHA_LOCAL = new Date(2026, 10, 27, 10, 32).toISOString();

function bloqueado(n) {
  return { estado: 'BLOQUEADO', standId: `stand-${n}` };
}

function desbloqueado(n, extra = {}) {
  return {
    estado: 'DESBLOQUEADO',
    standId: `stand-${n}`,
    standName: 'Estand Café',
    scannedAt: FECHA_LOCAL,
    xpGanada: 100,
    estrellas: 4,
    ...extra,
  };
}

test('calcularProgreso con 0 estands da 0 %', () => {
  assert.deepEqual(calcularProgreso([]), { conseguidos: 0, total: 0, porcentaje: 0 });
});

test('calcularProgreso con 3 de 8 da 38 %', () => {
  const sellos = [
    ...[1, 2, 3].map((n) => desbloqueado(n)),
    ...[4, 5, 6, 7, 8].map(bloqueado),
  ];
  assert.deepEqual(calcularProgreso(sellos), { conseguidos: 3, total: 8, porcentaje: 38 });
});

test('calcularProgreso con 8 de 8 da 100 %', () => {
  const sellos = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => desbloqueado(n));
  assert.deepEqual(calcularProgreso(sellos), { conseguidos: 8, total: 8, porcentaje: 100 });
});

test('formatearFechaSello usa dd/MM HH:mm en hora local', () => {
  assert.equal(formatearFechaSello(FECHA_LOCAL), '27/11 10:32');
  assert.equal(formatearFechaSello(new Date(2026, 0, 5, 7, 4).toISOString()), '05/01 07:04');
});

test('formatearEstrellas pinta estrellas llenas y vacías', () => {
  assert.equal(formatearEstrellas(4), '★★★★☆');
  assert.equal(formatearEstrellas(1), '★☆☆☆☆');
});

test('etiquetaAccesibleSello de una tarjeta bloqueada no revela el estand', () => {
  const etiqueta = etiquetaAccesibleSello(bloqueado(2), 1, 8);
  assert.equal(etiqueta, 'Sello 2 de 8, bloqueado');
  assert.ok(!etiqueta.includes('Estand Café'));
});

test('etiquetaAccesibleSello de una tarjeta desbloqueada', () => {
  assert.equal(
    etiquetaAccesibleSello(desbloqueado(1), 0, 8),
    'Sello 1 de 8, Estand Café, conseguido el 27/11 a las 10:32, 100 XP, 4 de 5 estrellas',
  );
  assert.equal(
    etiquetaAccesibleSello(desbloqueado(1, { estrellas: null }), 0, 8),
    'Sello 1 de 8, Estand Café, conseguido el 27/11 a las 10:32, 100 XP, sin valorar',
  );
});

test('los escenarios del mock cumplen la spec', () => {
  assert.equal(ESCENARIO_POR_DEFECTO, 'parcial');
  assert.equal(ESCENARIOS_PASAPORTE.sinEstands.sellos.length, 0);

  const sinSellos = calcularProgreso(ESCENARIOS_PASAPORTE.sinSellos.sellos);
  assert.ok(sinSellos.total > 0);
  assert.equal(sinSellos.conseguidos, 0);

  const parcial = ESCENARIOS_PASAPORTE.parcial.sellos;
  assert.deepEqual(calcularProgreso(parcial), { conseguidos: 3, total: 8, porcentaje: 38 });
  assert.ok(parcial.some((s) => s.estado === 'DESBLOQUEADO' && s.estrellas === null));

  const completo = calcularProgreso(ESCENARIOS_PASAPORTE.completo.sellos);
  assert.equal(completo.conseguidos, completo.total);

  for (const escenario of Object.values(ESCENARIOS_PASAPORTE)) {
    for (const sello of escenario.sellos) {
      if (sello.estado === 'BLOQUEADO') assert.ok(!('standName' in sello));
    }
  }
});
