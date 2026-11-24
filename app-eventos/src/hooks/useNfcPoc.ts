import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { NfcTagRepository, type UserWithoutWristband } from '../database/NfcTagRepository';
import type { NfcAvailability } from '../domain/nfc/nfcReaderPort';
import { scanTag, type NfcScanRecord, type ScanOutcome } from '../domain/nfc/scanTag';
import { generateUuidV4 } from '../domain/map/manageStand';
import { systemClock } from '../lib/systemAdapters';
import { createNfcManagerReader } from '../nfc/NfcManagerReader';

export interface NfcPocState {
  availability: NfcAvailability | 'CHECKING';
  scanning: boolean;
  lastOutcome: ScanOutcome | null;
  history: NfcScanRecord[];
  usersWithoutWristband: UserWithoutWristband[];
  error: string | null;
}

/** Prueba de concepto de la Spec 02: lector NFC + resolución en SQLite. */
export function useNfcPoc() {
  const database = useSQLiteContext();
  const repository = useMemo(() => new NfcTagRepository(database), [database]);
  const reader = useMemo(() => createNfcManagerReader(), []);
  const mounted = useRef(true);
  const [state, setState] = useState<NfcPocState>({
    availability: 'CHECKING',
    scanning: false,
    lastOutcome: null,
    history: [],
    usersWithoutWristband: [],
    error: null,
  });

  const refreshAvailability = useCallback(async () => {
    const availability = await reader.getAvailability();
    if (mounted.current) {
      setState((previous) => ({ ...previous, availability }));
    }
  }, [reader]);

  const refreshData = useCallback(async () => {
    try {
      const [history, usersWithoutWristband] = await Promise.all([
        repository.listRecentScans(),
        repository.listUsersWithoutWristband(),
      ]);
      if (mounted.current) {
        setState((previous) => ({ ...previous, history, usersWithoutWristband }));
      }
    } catch (error) {
      if (mounted.current) {
        setState((previous) => ({ ...previous, error: String(error) }));
      }
    }
  }, [repository]);

  useEffect(() => {
    mounted.current = true;
    void refreshAvailability();
    void refreshData();
    // Al volver de los ajustes de NFC se comprueba otra vez sin reiniciar la app.
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void refreshAvailability();
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      void reader.cancel();
    };
  }, [reader, refreshAvailability, refreshData]);

  const scan = useCallback(async () => {
    setState((previous) => ({ ...previous, scanning: true, error: null }));
    try {
      const outcome = await scanTag({
        reader,
        repository,
        now: systemClock.now,
        newId: generateUuidV4,
      });
      if (mounted.current) {
        setState((previous) => ({ ...previous, lastOutcome: outcome }));
      }
    } catch (error) {
      if (mounted.current) {
        setState((previous) => ({ ...previous, error: String(error) }));
      }
    } finally {
      if (mounted.current) {
        setState((previous) => ({ ...previous, scanning: false }));
      }
      await refreshData();
    }
  }, [reader, repository, refreshData]);

  const linkTestWristband = useCallback(
    async (uid: string, userId: string) => {
      try {
        await repository.linkTestWristband(uid, userId);
        setState((previous) => ({ ...previous, lastOutcome: null }));
      } catch (error) {
        setState((previous) => ({ ...previous, error: String(error) }));
      }
      await refreshData();
    },
    [repository, refreshData],
  );

  return {
    ...state,
    scan,
    cancel: () => reader.cancel(),
    openSettings: () => reader.openSettings(),
    linkTestWristband,
  };
}
