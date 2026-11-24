import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MapScreen from '../../src/screens/MapScreen';
import { syncEventos } from '../../src/sync/eventosSync';
import { createAppDatabase } from '../helpers/appDatabase';
import { plain } from '../helpers/sqliteHarness';

/**
 * Integración de la pantalla del mapa: hooks, repositorios y dominio reales sobre una base
 * SQLite de prueba. Solo se simulan la red, Supabase y el proveedor de avisos.
 */
let mockDatabase: unknown = null;
let mockNetwork = { isConnected: false, isInternetReachable: false };

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
  addDatabaseChangeListener: () => ({ remove: () => undefined }),
}));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('../../src/lib/supabase', () => require('../helpers/fakeSupabase').fakeSupabaseModule);
jest.mock('../../src/sync/eventosSync', () => ({ syncEventos: jest.fn() }));
jest.mock('../../src/providers/NotificationProvider', () => ({
  useEventNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    permissionState: 'granted',
    isOnline: false,
    canSimulate: false,
    error: null,
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    simulateNotification: jest.fn(),
  }),
}));

const mockedSyncEventos = jest.mocked(syncEventos);

describe('[US-03.1] [US-03.2] [US-03.4] pantalla del mapa', () => {
  let temp: Awaited<ReturnType<typeof createAppDatabase>>;

  beforeEach(async () => {
    mockNetwork = { isConnected: false, isInternetReachable: false };
    temp = await createAppDatabase();
    mockDatabase = temp.database;
  });

  afterEach(() => {

    temp.cleanup();

  });

  const renderLoaded = async () => {
    await render(<MapScreen />);
    await waitFor(() => expect(screen.getByText('Sala al 69%')).toBeOnTheScreen());
  };

  it('[US-03.4] sin conexión muestra el plano guardado en el dispositivo', async () => {
    await renderLoaded();

    expect(screen.getByText('Sin conexión')).toBeOnTheScreen();
    expect(screen.getByText(/último dato conocido, no es tiempo real/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Estand: Tecnología Verde. Pulsa para ver su ficha.')).toBeOnTheScreen();
  });

  it('[US-03.2] lista cada sala con su aforo, su nivel en texto y su icono', async () => {
    await renderLoaded();

    expect(screen.getByText('69 / 100 asistentes · Disponible (69%)')).toBeOnTheScreen();
    expect(screen.getByText('70 / 100 asistentes · Ocupación media (70%)')).toBeOnTheScreen();
    expect(screen.getByText('95 / 100 asistentes · Completo (95%)')).toBeOnTheScreen();
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Aforo: Completo').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Aforo: Disponible').length).toBeGreaterThan(0);
  });

  it('[US-03.1] al cambiar de evento muestra solo sus estands', async () => {
    await renderLoaded();
    expect(screen.queryByLabelText('Estand: Laboratorio Creativo. Pulsa para ver su ficha.')).toBeNull();

    await fireEvent.press(screen.getByText('Taller de Networking'));

    await waitFor(() =>
      expect(
        screen.getByLabelText('Estand: Laboratorio Creativo. Pulsa para ver su ficha.'),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.')).toBeNull();
  });

  it('[US-03.1] al tocar un estand abre su ficha y se puede cerrar', async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.'));

    expect(screen.getByText('Posición en el plano: 12.5, 18')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Cerrar'));
    await waitFor(() => expect(screen.queryByText('Posición en el plano: 12.5, 18')).toBeNull());
  });

  it('[US-03.2] al tocar una sala su ficha muestra el aforo y el nivel', async () => {
    await renderLoaded();

    const [zone] = screen.getAllByLabelText(/^Sala Sala al 95%/);
    await fireEvent.press(zone);

    const sheetDetails = screen.getAllByText('95 / 100 asistentes · Completo (95%)');
    expect(sheetDetails.length).toBeGreaterThanOrEqual(2);
  });

  it('[US-03.1] el zoom se puede ampliar y reducir', async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Aumentar zoom del mapa'));
    expect(screen.getByLabelText(/^Zoom \d+ por ciento$/)).not.toHaveAccessibleName('Zoom 100 por ciento');
    await fireEvent.press(screen.getByLabelText('Reducir zoom del mapa'));
    expect(screen.getByLabelText('Zoom 100 por ciento')).toBeOnTheScreen();
  });

  it('[US-03.4] "Sincronizar ahora" sin red avisa de que se conservan los datos locales', async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByText('Sincronizar ahora'));

    await waitFor(() =>
      expect(screen.getByText(/Se conservan y muestran los datos guardados/)).toBeOnTheScreen(),
    );
    expect(screen.getByText('Sala al 69%')).toBeOnTheScreen();
  });

  it('[US-03.4] si la sincronización falla con red, mantiene los datos locales y lo indica', async () => {
    mockNetwork = { isConnected: true, isInternetReachable: true };
    mockedSyncEventos.mockRejectedValue(new Error('Supabase caído'));

    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByText(/No se pudo sincronizar el mapa; se mantienen los datos locales/)).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.')).toBeOnTheScreen();
  });

  it('[US-03.4] un ATTENDEE no ve la gestión de estands', async () => {
    await renderLoaded();

    expect(screen.queryByText('＋ Añadir estand')).toBeNull();
    expect(screen.getByText(/El selector es temporal para la demo/)).toBeOnTheScreen();
  });

  it('[US-03.4] STAFF no puede guardar un estand sin nombre', async () => {
    await renderLoaded();
    await fireEvent.press(screen.getByText('STAFF · gestionar'));
    await fireEvent.press(screen.getByText('＋ Añadir estand'));

    expect(screen.getByText('Nuevo estand')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(screen.getByText('Escribe un nombre para el estand.')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Nuevo estand')).toBeNull();
  });

  it('[US-03.4] STAFF edita un estand y queda pendiente de sincronizar en SQLite', async () => {
    await renderLoaded();
    await fireEvent.press(screen.getByText('STAFF · gestionar'));
    await fireEvent.press(screen.getByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.'));
    await fireEvent.press(screen.getByText('Editar ubicación y datos'));

    expect(screen.getByText('Editar estand')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nombre del estand'), 'Innovación 2.0');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(screen.queryByText('Editar estand')).toBeNull());
    const [row] = plain(
      temp.sqlite
        .prepare("SELECT name, sync_status FROM stands WHERE id = '550e8400-e29b-41d4-a716-446655440001'")
        .all(),
    );
    expect(row).toEqual({ name: 'Innovación 2.0', sync_status: 'PENDING' });
  });
});
