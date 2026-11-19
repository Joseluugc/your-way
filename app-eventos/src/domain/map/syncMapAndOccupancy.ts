import { getMapSnapshot, type MapRepositoryPort } from './getMapSnapshot.ts';
import type { AccessLog, MapSnapshot, Stand, Zone } from './mapTypes';

export interface RemoteMapSnapshot {
  stands: Stand[];
  zones: Zone[];
  access_logs: AccessLog[];
  users: MapSyncUser[];
}

export interface MapSyncUser {
  id: string;
  name: string;
  email: string;
  role: 'ATTENDEE' | 'VIP' | 'STAFF' | 'EXHIBITOR';
  company: string | null;
  linkedin_url: string | null;
  created_at: string | null;
}

export interface MapRemoteDataSource {
  fetchSnapshot(): Promise<RemoteMapSnapshot>;
}

export interface MapSyncRepositoryPort extends MapRepositoryPort {
  applyRemoteSnapshot(snapshot: RemoteMapSnapshot, syncedAt: string): Promise<void>;
}

export interface SyncMapAndOccupancyResult {
  snapshot: MapSnapshot;
  source: 'local' | 'remote';
  is_real_time: false;
}

export async function syncMapAndOccupancy(
  repository: MapSyncRepositoryPort,
  remoteDataSource: MapRemoteDataSource,
  isOnline: boolean,
  syncedAt?: string,
): Promise<SyncMapAndOccupancyResult> {
  if (!isOnline) {
    return {
      snapshot: await getMapSnapshot(repository),
      source: 'local',
      is_real_time: false,
    };
  }

  const remoteSnapshot = await remoteDataSource.fetchSnapshot();
  await repository.applyRemoteSnapshot(remoteSnapshot, syncedAt ?? new Date().toISOString());

  return {
    snapshot: await getMapSnapshot(repository),
    source: 'remote',
    is_real_time: false,
  };
}
