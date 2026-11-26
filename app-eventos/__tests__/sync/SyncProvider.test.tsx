import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SyncProvider, useSync } from '../../src/providers/SyncProvider';
import { syncEventos } from '../../src/sync/eventosSync';

let mockNetwork = { isConnected: true, isInternetReachable: true };
let mockEstado: 'con-sesion' | 'sin-sesion' = 'con-sesion';

// Como el contexto real, devuelve siempre la misma base (si cambiara, re-sincronizaría en bucle).
const mockDb = { name: 'db-de-prueba' };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('../../src/sync/eventosSync', () => ({ syncEventos: jest.fn() }));
jest.mock('../../src/providers/AuthProvider', () => ({ useAuth: () => ({ estado: mockEstado }) }));

const mockedSync = jest.mocked(syncEventos);

function Consumer() {
  const { requestSync, lastSyncedAt } = useSync();
  return (
    <Pressable onPress={requestSync}>
      <Text>{lastSyncedAt ? 'sincronizado' : 'sin sincronizar'}</Text>
    </Pressable>
  );
}

const tree = () => (
  <SyncProvider>
    <Consumer />
  </SyncProvider>
);

describe('[US-07.1] [US-07.3] disparadores de la sincronización (SyncProvider)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = { isConnected: true, isInternetReachable: true };
    mockEstado = 'con-sesion';
    mockedSync.mockResolvedValue(undefined);
  });

  it('[US-08.2] sin sesión no sincroniza; al iniciar sesión sincroniza', async () => {
    mockEstado = 'sin-sesion';
    const view = await render(tree());
    expect(mockedSync).not.toHaveBeenCalled();

    mockEstado = 'con-sesion';
    await view.rerender(tree());

    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(1));
  });

  it('[US-07.1] sincroniza al montar y guarda la hora de la última sincronización', async () => {
    await render(tree());

    expect(mockedSync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('sincronizado')).toBeOnTheScreen());
  });

  it('[US-07.1] requestSync lanza otra sincronización', async () => {
    await render(tree());
    await fireEvent.press(screen.getByText(/sincronizado/));

    expect(mockedSync).toHaveBeenCalledTimes(2);
  });

  it('[US-07.3] un fallo de sincronización no rompe la app ni marca como sincronizado', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedSync.mockRejectedValue(new Error('Network request failed'));

    await render(tree());

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByText('sin sincronizar')).toBeOnTheScreen();
    warn.mockRestore();
  });

  it('[US-07.1] al recuperar la conexión vuelve a sincronizar', async () => {
    mockNetwork = { isConnected: false, isInternetReachable: false };
    const view = await render(tree());
    expect(mockedSync).toHaveBeenCalledTimes(1);

    mockNetwork = { isConnected: true, isInternetReachable: true };
    await view.rerender(tree());

    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(2));
  });

  it('[US-07.1] seguir conectado no dispara sincronizaciones extra', async () => {
    const view = await render(tree());
    await view.rerender(tree());

    expect(mockedSync).toHaveBeenCalledTimes(1);
  });

  it('[US-07.1] useSync fuera del proveedor lanza un error claro', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Consumer />)).rejects.toThrow('useSync debe usarse dentro de SyncProvider.');
  });
});
