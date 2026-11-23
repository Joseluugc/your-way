import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useNetworkState } from 'expo-network';
import { syncEventos } from '../sync/eventosSync';

interface SyncContextValue {
  /** Lanza una sincronización. Nunca lanza errores: un fallo deja los eventos `pending`. */
  requestSync: () => void;
  /** Hora local de la última sincronización correcta (solo en memoria). */
  lastSyncedAt: Date | null;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Dispara la sincronización de `eventos` al montar y al recuperar la conexión.
 * Debe montarse dentro de `SQLiteProvider`.
 */
export function SyncProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const networkState = useNetworkState();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const wasOnline = useRef<boolean | null>(null);

  const requestSync = useCallback(() => {
    syncEventos(database)
      .then(() => setLastSyncedAt(new Date()))
      .catch((error: unknown) => {
        console.warn('Sincronización de eventos fallida; se reintentará más tarde.', error);
      });
  }, [database]);

  useEffect(() => {
    requestSync();
  }, [requestSync]);

  const online = networkState.isConnected === true && networkState.isInternetReachable !== false;

  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    // Solo al pasar de desconectado a conectado; el montaje ya sincroniza arriba.
    if (online && previous === false) {
      requestSync();
    }
  }, [online, requestSync]);

  const value = useMemo(() => ({ requestSync, lastSyncedAt }), [requestSync, lastSyncedAt]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync debe usarse dentro de SyncProvider.');
  }
  return context;
}
