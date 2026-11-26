import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ComponentType } from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import TabsLayout from '../../src/app/(tabs)/_layout';
import type { Rol } from '../../src/domain/auth/authTypes';

// Se carga sin sus tipos: `expo-router/testing-library` amplía `expect` de una forma que rompe
// en `tsc` los matchers de @testing-library/react-native (toBeOnTheScreen…) en todo el proyecto.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderRouter } = require('expo-router/testing-library') as {
  renderRouter: (rutas: Record<string, ComponentType>, opciones: { initialUrl: string }) => Promise<unknown>;
};

let mockRol: Rol = 'STAFF';
jest.mock('../../src/providers/AuthProvider', () => ({
  useAuth: () => ({ rol: mockRol, logout: jest.fn() }),
}));

const pantalla = (texto: string) => () => <Text>{`pantalla ${texto}`}</Text>;

// Rutas reales del grupo (tabs) con pantallas mínimas: se prueba la navegación, no las pantallas.
const rutas = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': pantalla('resumen'),
  '(tabs)/pasaporte': pantalla('pasaporte'),
  '(tabs)/escaner': pantalla('escaner'),
  '(tabs)/mapa': pantalla('mapa'),
  '(tabs)/puertas': pantalla('puertas'),
  '(tabs)/nfc': pantalla('nfc'),
};

const pestanasVisibles = () =>
  ['Resumen', 'Pasaporte', 'Escáner', 'Mapa', 'Puertas'].filter(
    (etiqueta) => screen.queryAllByText(etiqueta).length > 0,
  );

describe('[US-08.4] pestañas por rol', () => {
  beforeEach(() => {
    mockRol = 'STAFF';
  });

  it('STAFF ve Resumen, Mapa y Puertas y arranca en Resumen', async () => {
    await renderRouter(rutas, { initialUrl: '/' });

    expect(screen.getByText('pantalla resumen')).toBeOnTheScreen();
    expect(pestanasVisibles()).toEqual(['Resumen', 'Mapa', 'Puertas']);
  });

  it.each<Rol>(['ATTENDEE', 'VIP', 'EXHIBITOR'])('%s ve Pasaporte, Escáner y Mapa', async (rol) => {
    mockRol = rol;
    await renderRouter(rutas, { initialUrl: '/pasaporte' });

    expect(pestanasVisibles()).toEqual(['Pasaporte', 'Escáner', 'Mapa']);
  });

  it.each(['/', '/puertas'])('un ATTENDEE que abre %s no llega a la ruta de STAFF', async (url) => {
    mockRol = 'ATTENDEE';
    await renderRouter(rutas, { initialUrl: url });

    expect(screen.queryByText('pantalla resumen')).toBeNull();
    expect(screen.queryByText('pantalla puertas')).toBeNull();
    expect(screen.getByText('pantalla pasaporte')).toBeOnTheScreen();
  });

  it('un STAFF que abre /pasaporte vuelve a Resumen', async () => {
    await renderRouter(rutas, { initialUrl: '/pasaporte' });

    expect(screen.queryByText('pantalla pasaporte')).toBeNull();
    expect(screen.getByText('pantalla resumen')).toBeOnTheScreen();
  });
});
