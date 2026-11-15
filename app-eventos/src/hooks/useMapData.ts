import { useCallback, useEffect, useState } from 'react';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { useNetworkState } from 'expo-network';
import { getMapSnapshot } from '../domain/map/getMapSnapshot';
import type { MapSnapshot } from '../domain/map/mapTypes';
import { MapRepository } from '../database/MapRepository';

interface MapDataState {
  snapshot: MapSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useMapData() {
  const database = useSQLiteContext();
  const networkState = useNetworkState();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<MapDataState>({
    snapshot: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setReloadVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const repository = new MapRepository(database);

    void getMapSnapshot(repository)
      .then((snapshot) => {
        if (active) {
          setState({ snapshot, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error
              ? `No se pudo cargar el mapa local: ${error.message}`
              : 'No se pudo cargar el mapa local.',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, reloadVersion, networkState.isConnected, networkState.isInternetReachable]);

  useEffect(() => {
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (
        tableName === 'stands' ||
        tableName === 'zones' ||
        tableName === 'access_logs' ||
        tableName === 'local_sync_state'
      ) {
        setReloadVersion((version) => version + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  return {
    ...state,
    isOffline:
      networkState.isConnected === false || networkState.isInternetReachable === false,
    refresh,
  };
}
