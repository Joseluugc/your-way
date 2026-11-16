import { useCallback, useEffect, useState } from 'react';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { deleteEvent, getEventos, type Evento } from '../database/eventQueries';

interface EventosState {
  eventos: Evento[];
  loading: boolean;
  error: string | null;
}

/**
 * Lee los eventos de la base SQLite local y se recarga automáticamente
 * cuando cambia la tabla `eventos` (requiere `enableChangeListener` en el provider).
 */
export function useEventos() {
  const database = useSQLiteContext();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<EventosState>({ eventos: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    getEventos(database)
      .then((eventos) => {
        if (active) setState({ eventos, loading: false, error: null });
      })
      .catch(() => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: 'No se pudieron cargar los eventos locales.',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, reloadVersion]);

  useEffect(() => {
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tableName === 'eventos') {
        setReloadVersion((version) => version + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  const remove = useCallback((id: string) => deleteEvent(database, id), [database]);

  return { ...state, refresh, remove };
}
