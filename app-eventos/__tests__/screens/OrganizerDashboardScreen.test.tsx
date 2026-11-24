import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OrganizerDashboardScreen from '../../src/screens/OrganizerDashboardScreen';
import { confirmAction } from '../../src/utils/dialogs';
import { createAppDatabase } from '../helpers/appDatabase';

/**
 * Integración del dashboard del organizador: hooks y repositorios reales sobre SQLite de
 * prueba. Se simulan el proveedor de sincronización y los diálogos.
 */
type ChangeListener = (event: { tableName: string }) => void;

let mockDatabase: unknown = null;
const mockListeners = new Set<ChangeListener>();
const mockRequestSync = jest.fn();
let mockLastSyncedAt: Date | null = null;

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
  addDatabaseChangeListener: (listener: ChangeListener) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
}));
jest.mock('../../src/providers/SyncProvider', () => ({
  useSync: () => ({ requestSync: mockRequestSync, lastSyncedAt: mockLastSyncedAt }),
}));
jest.mock('../../src/utils/dialogs', () => ({
  showMessage: jest.fn(),
  // El usuario confirma siempre.
  confirmAction: jest.fn((_title: string, _message: string, _label: string, onConfirm: () => void) =>
    onConfirm(),
  ),
}));

/** Simula el aviso de cambios de `expo-sqlite` (en la app lo emite el motor nativo). */
const emitChange = (tableName: string) =>
  act(() => {
    for (const listener of mockListeners) listener({ tableName });
  });

describe('[US-01.3] dashboard del organizador', () => {
  let temp: Awaited<ReturnType<typeof createAppDatabase>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockLastSyncedAt = null;
    temp = await createAppDatabase();
    temp.sqlite.exec(`
      INSERT INTO users (id, name, email, role) VALUES
        ('u1', 'Ana', 'a@t.com', 'ATTENDEE'),
        ('u2', 'Luis', 'l@t.com', 'ATTENDEE'),
        ('u3', 'María', 'm@t.com', 'VIP');
      INSERT INTO leads (id, scanner_user_id, scanned_user_id) VALUES ('lead-1', 'u3', 'u1');
    `);
    mockDatabase = temp.database;
  });

  afterEach(() => {

    temp.cleanup();

  });

  const renderLoaded = async () => {
    await render(<OrganizerDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Asistencia')).toBeOnTheScreen());
  };

  it('[US-01.3] resume los datos guardados en el dispositivo', async () => {
    await renderLoaded();

    expect(screen.getByText('USUARIOS')).toBeOnTheScreen();
    expect(screen.getByText('Asistentes')).toBeOnTheScreen();
    expect(screen.getByText('VIP')).toBeOnTheScreen();
    expect(screen.getByText('Datos locales')).toBeOnTheScreen();
    expect(screen.getByText('Resumen calculado desde la base local del dispositivo.')).toBeOnTheScreen();
  });

  it('[US-01.3] muestra el aforo de cada zona', async () => {
    await renderLoaded();

    expect(screen.getByText('Sala al 95%')).toBeOnTheScreen();
    expect(screen.getByText('95 / 100')).toBeOnTheScreen();
  });

  it('[US-07.1] lista los eventos programados y marca los pendientes de sincronizar', async () => {
    await renderLoaded();

    await waitFor(() => expect(screen.getByText('Presentación Your Way')).toBeOnTheScreen());
    expect(screen.getByText('Taller de Networking')).toBeOnTheScreen();
    expect(screen.getAllByText('Pendiente de sincronizar')).toHaveLength(2);
  });

  it('[US-07.1] muestra la hora de la última sincronización', async () => {
    mockLastSyncedAt = new Date(2026, 10, 24, 9, 5);
    await renderLoaded();

    expect(screen.getByText(/Última sincronización: 09:05/)).toBeOnTheScreen();
  });

  it('[US-07.1] mantener pulsado un evento lo borra (borrado lógico) y pide sincronizar', async () => {
    await renderLoaded();
    await waitFor(() => expect(screen.getByText('Taller de Networking')).toBeOnTheScreen());

    await fireEvent(screen.getByText('Taller de Networking'), 'longPress');

    expect(jest.mocked(confirmAction)).toHaveBeenCalled();
    await waitFor(() => expect(mockRequestSync).toHaveBeenCalled());
    await emitChange('eventos');
    await waitFor(() => expect(screen.queryByText('Taller de Networking')).toBeNull());

    const row = temp.sqlite
      .prepare("SELECT deleted_at, sync_status FROM eventos WHERE titulo = 'Taller de Networking'")
      .get() as { deleted_at: string | null; sync_status: string };
    expect(row.deleted_at).not.toBeNull();
    expect(row.sync_status).toBe('pending');
  });

  it('[US-07.1] "+ Crear Nuevo Evento" abre el formulario y "Cancelar" lo cierra', async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByText('+ Crear Nuevo Evento'));
    expect(screen.getByText('Nuevo Evento')).toBeOnTheScreen();
    expect(screen.getByText('Guardar Evento')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Cancelar'));
    await waitFor(() => expect(screen.queryByText('Guardar Evento')).toBeNull());
  });

  it('[US-01.3] si la base local falla muestra el error y permite reintentar', async () => {
    const failing = () => Promise.reject(new Error('base corrupta'));
    mockDatabase = {
      getAllAsync: failing,
      getFirstAsync: failing,
      runAsync: failing,
      execAsync: failing,
      withTransactionAsync: failing,
    };
    await render(<OrganizerDashboardScreen />);

    await waitFor(() =>
      expect(screen.getByText('No se pudieron cargar las estadísticas locales.')).toBeOnTheScreen(),
    );
    mockDatabase = temp.database;
    await fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(screen.getByText('Asistencia')).toBeOnTheScreen());
  });
});
