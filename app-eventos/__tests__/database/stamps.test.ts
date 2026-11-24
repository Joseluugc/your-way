import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { GamificationRepository } from '../../src/database/GamificationRepository';
import { initializeDatabase, runMigrations } from '../../src/database/initializeDatabase';
import type { PassportStamp } from '../../src/domain/gamification/types';
import { createTempDatabase } from '../helpers/sqliteHarness';

const EVENTO_ID = '00000000-0000-4000-8000-000000000001';
const STAND_ID = 'd3000000-0000-4000-8000-000000000001';
const OTHER_STAND_ID = 'd3000000-0000-4000-8000-000000000002';
const USER_ID = 'd1000000-0000-4000-8000-000000000001';

function stamp(id: string, standId = STAND_ID, scannedAt = '2026-11-15T10:00:00.000Z'): PassportStamp {
  return {
    id,
    user_id: USER_ID,
    stand_id: standId,
    evento_id: EVENTO_ID,
    scanned_at: scannedAt,
    zone_level_at_scan: 'available',
    applied_multiplier: 1,
    trivia_result: 'PENDING',
    trivia_answered_at: null,
  };
}

/**
 * Doble del remoto con la restricción de Supabase `UNIQUE (user_id, stand_id)` y la
 * semántica de subida `INSERT ... ON CONFLICT DO NOTHING` (contracts/supabase-sync.md).
 */
class RemoteStamps {
  readonly rows = new Map<string, PassportStamp>();

  async uploadUserStamps(stamps: readonly PassportStamp[]): Promise<void> {
    for (const row of stamps) {
      const key = `${row.user_id}|${row.stand_id}`;
      if (!this.rows.has(key)) this.rows.set(key, row);
    }
  }
}

describe('[US-04.1] sellos sin duplicados', () => {
  let temp: ReturnType<typeof createTempDatabase>;
  let repository: GamificationRepository;

  beforeEach(async () => {
    temp = createTempDatabase();
    await initializeDatabase(temp.database);
    await runMigrations(temp.database);
    temp.sqlite.exec(`
      INSERT INTO stands (id, name, map_x, map_y, evento_id) VALUES
        ('${STAND_ID}', 'Estand A', 10, 10, '${EVENTO_ID}'),
        ('${OTHER_STAND_ID}', 'Estand B', 20, 20, '${EVENTO_ID}');
    `);
    repository = new GamificationRepository(temp.database);
  });

  afterEach(() => {

    temp.cleanup();

  });

  const count = () =>
    (temp.sqlite.prepare('SELECT COUNT(*) AS n FROM user_stamps').get() as { n: number }).n;

  it('[US-04.1] un segundo escaneo del mismo usuario en el mismo estand no crea otro sello en SQLite', async () => {
    await repository.insertStamp(stamp('sello-1'));

    await expect(
      repository.insertStamp(stamp('sello-2', STAND_ID, '2026-11-15T10:05:00.000Z')),
    ).rejects.toThrow(/UNIQUE/);
    expect(count()).toBe(1);
    expect((await repository.getStamp(USER_ID, STAND_ID))?.id).toBe('sello-1');
  });

  it('[US-04.1] el mismo usuario sí puede sellar estands distintos', async () => {
    await repository.insertStamp(stamp('sello-1'));
    await repository.insertStamp(stamp('sello-2', OTHER_STAND_ID));
    expect(count()).toBe(2);
  });

  it('[US-04.1] la tabla antigua stamps también rechaza el duplicado', () => {
    temp.sqlite.exec(`INSERT INTO users (id, name, email) VALUES ('${USER_ID}', 'Ana', 'a@t.com')`);
    temp.sqlite.exec(
      `INSERT INTO stamps (id, user_id, stand_id) VALUES ('legacy-1', '${USER_ID}', '${STAND_ID}')`,
    );
    expect(() =>
      temp.sqlite.exec(
        `INSERT INTO stamps (id, user_id, stand_id) VALUES ('legacy-2', '${USER_ID}', '${STAND_ID}')`,
      ),
    ).toThrow(/UNIQUE/);
  });

  it('[US-04.1] al sincronizar, el sello solo se sube una vez aunque se repita la subida', async () => {
    const remote = new RemoteStamps();
    await repository.insertStamp(stamp('sello-1'));

    const pending = await repository.listPendingStamps();
    await remote.uploadUserStamps(pending);
    // Reintento tras un corte: se vuelve a subir lo mismo antes de marcarlo.
    await remote.uploadUserStamps(pending);
    await repository.markSynced('user_stamps', pending.map((row) => row.id));

    expect(remote.rows.size).toBe(1);
    expect(await repository.listPendingStamps()).toEqual([]);
  });

  it('[US-04.1] tras sincronizar, un escaneo repetido no deja nada nuevo pendiente de subir', async () => {
    await repository.insertStamp(stamp('sello-1'));
    await repository.markSynced('user_stamps', ['sello-1']);

    await expect(repository.insertStamp(stamp('sello-2'))).rejects.toThrow(/UNIQUE/);
    expect(await repository.listPendingStamps()).toEqual([]);
  });
});
