import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { useNetworkState } from 'expo-network';
import { getMapSnapshot } from '../domain/map/getMapSnapshot';
import { syncMapAndOccupancy } from '../domain/map/syncMapAndOccupancy';
import type { MapSnapshot } from '../domain/map/mapTypes';
import { MapRepository } from '../database/MapRepository';
import { SupabaseMapDataSource } from '../sync/supabaseMapDataSource';
import { ensureSession } from '../lib/supabase';
import { syncEventos } from '../sync/eventosSync';
import type { Evento } from '../database/eventQueries';

type MapSyncStatus = 'idle' | 'offline' | 'syncing' | 'synced' | 'error';

interface MapDataState {
  snapshot: MapSnapshot | null;
  events: Evento[];
  eventsLoaded: boolean;
  loading: boolean;
  error: string | null;
  syncError: string | null;
  syncStatus: MapSyncStatus;
}

export function useMapData() {
  const database = useSQLiteContext();
  const networkState = useNetworkState();
  const isOffline =
    networkState.isConnected === false || networkState.isInternetReachable === false;
  const isOnline =
    networkState.isConnected === true && networkState.isInternetReachable !== false;
  const [reloadVersion, setReloadVersion] = useState(0);
  const [syncVersion, setSyncVersion] = useState(0);
  const [state, setState] = useState<MapDataState>({
    snapshot: null,
    events: [],
    eventsLoaded: false,
    loading: true,
    error: null,
    syncError: null,
    syncStatus: 'idle',
  });
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!isOnline) {
      setState((current) => ({
        ...current,
        syncError: 'Sin conexión. Se conservan y muestran los datos guardados en este dispositivo.',
        syncStatus: 'offline',
      }));
      setReloadVersion((version) => version + 1);
      return;
    }

    setState((current) => ({ ...current, syncError: null }));
    setSyncVersion((version) => version + 1);
  }, [isOnline]);

  useEffect(() => {
    let active = true;
    const repository = new MapRepository(database);

    void repository.getEvents()
      .then((events) => {
        if (active) {
          setState((current) => ({ ...current, events, eventsLoaded: true }));
          if (!activeEventId || !events.some((event) => event.id === activeEventId)) {
            setActiveEventId(events[0]?.id ?? null);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            eventsLoaded: true,
            error: loadError instanceof Error
              ? `No se pudieron cargar los eventos locales: ${loadError.message}`
              : 'No se pudieron cargar los eventos locales.',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, reloadVersion, activeEventId]);

  useEffect(() => {
    let active = true;
    const repository = new MapRepository(database);

    void getMapSnapshot(repository, activeEventId)
      .then((snapshot) => {
        if (active) {
          setState((current) => ({
            ...current,
            snapshot,
            loading: false,
            error: null,
            syncStatus: isOffline ? 'offline' : current.syncStatus,
          }));
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: loadError instanceof Error
              ? `No se pudo cargar el mapa local: ${loadError.message}`
              : 'No se pudo cargar el mapa local.',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, reloadVersion, isOffline, activeEventId]);

  useEffect(() => {
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (
        tableName === 'stands' ||
        tableName === 'zones' ||
        tableName === 'access_logs' ||
        tableName === 'local_sync_state' ||
        tableName === 'eventos'
      ) {
        setReloadVersion((version) => version + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isOnline || !state.eventsLoaded) {
      return;
    }

    let active = true;
    const repository = new MapRepository(database);

    void Promise.resolve()
      .then(() => {
        if (active) {
          setState((current) => ({
            ...current,
            syncError: null,
            syncStatus: 'syncing',
          }));
        }
        return syncEventos(database)
          .then(() => ensureSession())
          .then((conSesion) =>
            // Sin sesión (Spec 08) se trata como sin red: snapshot local, estands `PENDING`.
            syncMapAndOccupancy(
              repository,
              new SupabaseMapDataSource(),
              conSesion,
              undefined,
              activeEventId,
            ),
          );
      })
      .then((result) => {
        if (active) {
          setState((current) => ({
            ...current,
            snapshot: result.snapshot,
            loading: false,
            error: null,
            syncError: null,
            syncStatus: 'synced',
          }));
        }
      })
      .catch((syncError: unknown) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            syncError: syncError instanceof Error
              ? `No se pudo sincronizar el mapa; se mantienen los datos locales. ${syncError.message}`
              : 'No se pudo sincronizar el mapa; se mantienen los datos locales.',
            syncStatus: 'error',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, isOnline, syncVersion, state.eventsLoaded, activeEventId]);

  return useMemo(
    () => ({
      ...state,
      activeEventId,
      setActiveEventId,
      isOffline,
      refresh,
    }),
    [state, activeEventId, isOffline, refresh],
  );
}
