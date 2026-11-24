import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import IndexRoute from '../../src/app/index';
import MapaRoute from '../../src/app/mapa';
import CreateEventScreen from '../../src/screens/CreateEventScreen';
import { createAppDatabase } from '../helpers/appDatabase';
import {
  findContrastIssues,
  findUnlabeledInteractive,
  formatContrastIssues,
  type HostNode,
} from '../helpers/accessibilityAudit';

/**
 * Auditoría automática de accesibilidad (Spec 06, US-06.3) de las rutas `index` y `mapa`
 * y del formulario de creación de eventos, en varios estados (modales y formularios abiertos).
 */
let mockDatabase: unknown = null;

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
  addDatabaseChangeListener: () => ({ remove: () => undefined }),
}));
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: false, isInternetReachable: false }),
}));
jest.mock('../../src/lib/supabase', () => require('../helpers/fakeSupabase').fakeSupabaseModule);
jest.mock('../../src/providers/SyncProvider', () => ({
  useSync: () => ({ requestSync: jest.fn(), lastSyncedAt: null }),
}));
jest.mock('../../src/providers/NotificationProvider', () => ({
  useEventNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    permissionState: 'undetermined',
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

const root = () => screen.container as unknown as HostNode;

function expectAccessible(state: string) {
  const unlabeled = findUnlabeledInteractive(root());
  const contrast = formatContrastIssues(findContrastIssues(root()));
  expect({ state, unlabeled, contrast }).toEqual({ state, unlabeled: [], contrast: [] });
}

describe('[US-06.3] auditoría de accesibilidad de las pantallas', () => {
  let temp: Awaited<ReturnType<typeof createAppDatabase>>;

  beforeEach(async () => {
    temp = await createAppDatabase();
    mockDatabase = temp.database;
  });

  afterEach(() => {
    temp.cleanup();
  });

  it('[US-06.3] ruta index (dashboard): etiquetas y contraste', async () => {
    await render(<IndexRoute />);
    await waitFor(() => expect(screen.getByText('Presentación Your Way')).toBeOnTheScreen());
    expectAccessible('dashboard');

    await fireEvent.press(screen.getByText('+ Crear Nuevo Evento'));
    expectAccessible('dashboard con el formulario de evento abierto');
  });

  it('[US-06.3] ruta mapa: etiquetas y contraste', async () => {
    await render(<MapaRoute />);
    await waitFor(() => expect(screen.getByText('Sala al 69%')).toBeOnTheScreen());
    expectAccessible('mapa');

    await fireEvent.press(screen.getByLabelText('Estand: Innovación Digital. Pulsa para ver su ficha.'));
    expectAccessible('mapa con la ficha de un estand');
    await fireEvent.press(screen.getAllByLabelText('Cerrar ficha')[0]);

    await fireEvent.press(screen.getAllByLabelText(/^Sala Sala al 95%/)[0]);
    expectAccessible('mapa con la ficha de una sala');
    await fireEvent.press(screen.getAllByLabelText('Cerrar ficha')[0]);

    await fireEvent.press(screen.getByLabelText('Abrir centro de avisos. 0 sin leer'));
    expectAccessible('mapa con el centro de avisos abierto');
  });

  it('[US-06.3] ruta mapa en modo STAFF con el formulario de estand: etiquetas y contraste', async () => {
    await render(<MapaRoute />);
    await waitFor(() => expect(screen.getByText('Sala al 69%')).toBeOnTheScreen());
    await fireEvent.press(screen.getByText('STAFF · gestionar'));
    await fireEvent.press(screen.getByText('＋ Añadir estand'));
    expectAccessible('mapa STAFF con formulario de estand');
  });

  it('[US-06.3] formulario de creación de eventos: etiquetas y contraste', async () => {
    await render(<CreateEventScreen />);
    expectAccessible('formulario de evento');
  });
});
