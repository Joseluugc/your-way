import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthError } from '../src/domain/auth/authTypes.ts';
import { validarCredenciales } from '../src/domain/auth/credenciales.ts';
import { esStaff, pestanasPorRol } from '../src/domain/auth/roles.ts';
import {
  decidirTrasFalloRefresco,
  mensajeErrorAuth,
  parsearPerfil,
  serializarPerfil,
} from '../src/domain/auth/sesion.ts';

const ELENA = {
  id: 'd1000000-0000-4000-8000-000000000008',
  nombre: 'Elena Navarro',
  email: 'elena.navarro@yourway.demo',
  rol: 'STAFF',
};

test('[US-08.1] acepta email válido y contraseña de al menos 6 caracteres', () => {
  assert.equal(validarCredenciales({ email: 'ana@yourway.demo', password: '123456' }), null);
  assert.equal(
    validarCredenciales({ email: ' ana@yourway.demo ', password: 'secreta', nombre: 'Ana' }),
    null,
  );
});

test('[US-08.1] rechaza email mal formado, contraseña corta y nombre vacío en el registro', () => {
  assert.equal(validarCredenciales({ email: 'ana', password: '123456' }), 'Escribe un email válido');
  assert.equal(
    validarCredenciales({ email: 'ana@yourway.demo', password: '12345' }),
    'La contraseña debe tener al menos 6 caracteres',
  );
  assert.equal(
    validarCredenciales({ email: 'ana@yourway.demo', password: '123456', nombre: '   ' }),
    'Escribe tu nombre',
  );
});

test('[US-08.1] los errores de autenticación muestran los textos acordados', () => {
  assert.equal(mensajeErrorAuth('credenciales-invalidas'), 'Email o contraseña incorrectos');
  assert.equal(mensajeErrorAuth('email-registrado'), 'Ese email ya está registrado');
  assert.equal(mensajeErrorAuth('sin-red'), 'Necesitas conexión para iniciar sesión');
  assert.equal(mensajeErrorAuth('sesion-invalida'), 'Tu sesión ha caducado');
  assert.equal(new AuthError('sin-red').tipo, 'sin-red');
});

test('[US-08.2] un fallo de red mantiene la sesión; una sesión inválida la cierra', () => {
  assert.equal(decidirTrasFalloRefresco('sin-red'), 'mantener');
  assert.equal(decidirTrasFalloRefresco('desconocido'), 'mantener');
  assert.equal(decidirTrasFalloRefresco('sesion-invalida'), 'cerrar');
});

test('[US-08.2] el perfil guardado se recupera tal cual', () => {
  assert.deepEqual(parsearPerfil(serializarPerfil(ELENA)), ELENA);
});

test('[US-08.2] un perfil guardado ausente, corrupto o con rol desconocido se ignora', () => {
  assert.equal(parsearPerfil(null), null);
  assert.equal(parsearPerfil(''), null);
  assert.equal(parsearPerfil('{no es json'), null);
  assert.equal(parsearPerfil('null'), null);
  assert.equal(parsearPerfil(JSON.stringify({ ...ELENA, rol: 'ORGANIZER' })), null);
  assert.equal(parsearPerfil(JSON.stringify({ ...ELENA, id: '' })), null);
});

test('[US-08.4] STAFF ve Resumen, Mapa y Puertas', () => {
  assert.equal(esStaff('STAFF'), true);
  assert.deepEqual(pestanasPorRol('STAFF'), ['index', 'mapa', 'puertas']);
});

test('[US-08.4] ATTENDEE, VIP y EXHIBITOR ven Pasaporte, Escáner y Mapa', () => {
  for (const rol of ['ATTENDEE', 'VIP', 'EXHIBITOR']) {
    assert.equal(esStaff(rol), false);
    assert.deepEqual(pestanasPorRol(rol), ['pasaporte', 'escaner', 'mapa']);
  }
});
