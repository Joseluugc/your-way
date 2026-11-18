export type LocalSyncState = { sync_status: 'pending' | 'synced' } | null;

/**
 * Decide si una fila bajada de Supabase se aplica sobre la local.
 * Una fila local pendiente gana hasta que se sube (Spec 07).
 */
export function shouldApplyRemote(local: LocalSyncState): boolean {
  return local === null || local.sync_status === 'synced';
}
