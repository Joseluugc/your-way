import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  OrganizerDashboardRepository,
  type OrganizerDashboardStats,
} from '../database/OrganizerDashboardRepository';

interface OrganizerDashboardState {
  stats: OrganizerDashboardStats | null;
  loading: boolean;
  error: string | null;
}

export function useOrganizerDashboard() {
  const database = useSQLiteContext();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<OrganizerDashboardState>({
    stats: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const repository = new OrganizerDashboardRepository(database);

    setState((current) => ({ ...current, loading: true, error: null }));
    void repository
      .getStats()
      .then((stats) => {
        if (active) {
          setState({ stats, loading: false, error: null });
        }
      })
      .catch(() => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: 'No se pudieron cargar las estadísticas locales.',
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [database, reloadVersion]);

  return {
    ...state,
    refresh: () => setReloadVersion((version) => version + 1),
  };
}