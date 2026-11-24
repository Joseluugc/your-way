import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEMO_EVENTO,
  DEMO_NFC_TAGS,
  DEMO_STANDS,
  DEMO_USERS,
  DEMO_ZONES,
} from '../src/database/demoSeedData.ts';
import {
  initializeAppDatabase,
  initializeDatabase,
  runMigrations,
  seedDevData,
} from '../src/database/initializeDatabase.ts';
import { createTempDatabase } from './sqliteHarness.mjs';

const SEED_SQL = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8');
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENTO_ID = '00000000-0000-4000-8000-000000000001';
const USER_1 = '850e8400-e29b-41d4-a716-000000000001';
const USER_2 = '850e8400-e29b-41d4-a716-000000000002';
const STAND = '750e8400-e29b-41d4-a716-000000000001';
const ZONE = '950e8400-e29b-41d4-a716-000000000001';

async function runInitialize(database, dev) {
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = dev;
  try {
    await initializeAppDatabase(database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
}

function userVersion(sqlite) {
  return sqlite.prepare('PRAGMA user_version').get().user_version;
}

function tableCounts(sqlite) {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name)
    .sort();
  return Object.fromEntries(
    tables.map((name) => [name, sqlite.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n]),
  );
}

/** Convierte una tupla SQL `('a', NULL, 3)` en `['a', null, 3]`. */
function parseTuple(line) {
  const values = [];
  const body = line.trim().replace(/^\(/, '').replace(/\),?$/, '');
  const token = /\s*(?:'((?:[^']|'')*)'|(NULL)|(-?\d+(?:\.\d+)?))\s*(?:,|$)/gy;
  let match;
  while (token.lastIndex < body.length && (match = token.exec(body)) !== null) {
    if (match[1] !== undefined) values.push(match[1].replace(/''/g, "'"));
    else if (match[2] !== undefined) values.push(null);
    else values.push(Number(match[3]));
  }
  return values;
}

/** Filas de `INSERT INTO <table> (...) VALUES ... ON CONFLICT` en seed.sql, como objetos. */
function seedRows(table) {
  const block = new RegExp(
    `INSERT INTO ${table} \\(([^)]*)\\) VALUES\\n([\\s\\S]*?)\\nON CONFLICT \\(id\\) DO NOTHING;`,
  ).exec(SEED_SQL);
  assert.ok(block, `seed.sql no tiene el INSERT de ${table}`);
  const columns = block[1].split(',').map((column) => column.trim());
  return block[2].split('\n').map((line) => {
    const values = parseTuple(line);
    assert.equal(values.length, columns.length, `fila mal formada en ${table}: ${line}`);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

/** `node:sqlite` devuelve objetos sin prototipo: se copian a objetos normales para compararlos. */
const plain = (rows) => rows.map((row) => ({ ...row }));
const byId = (rows) => plain(rows).sort((a, b) => a.id.localeCompare(b.id));

/** BD en versión 4 (antes de esta spec) con datos en las tablas principales. */
async function createVersion4Database() {
  const temp = createTempDatabase('your-way-demo-seed-');
  await initializeDatabase(temp.database);
  await runMigrations(temp.database, 4);
  temp.sqlite.exec(`
    INSERT INTO users (id, name, email, role) VALUES
      ('${USER_1}', 'Ana', 'ana@test.com', 'ATTENDEE'),
      ('${USER_2}', 'Luis', 'luis@test.com', 'VIP');
    INSERT INTO zones (id, name, max_capacity, required_role) VALUES
      ('${ZONE}', 'Sala', 100, 'ATTENDEE');
    INSERT INTO stands (id, name, owner_id, map_x, map_y, evento_id, zone_id) VALUES
      ('${STAND}', 'Estand', '${USER_1}', 10, 10, '${EVENTO_ID}', '${ZONE}');
    INSERT INTO nfc_tags (uid, type, user_id, stand_id, zone_id) VALUES
      ('tag-ana', 'USER_WRISTBAND', '${USER_1}', NULL, NULL),
      ('tag-estand', 'STAND_POINT', NULL, '${STAND}', NULL),
      ('tag-sala', 'ZONE_CHECKPOINT', NULL, NULL, '${ZONE}');
    INSERT INTO stamps (id, user_id, stand_id) VALUES ('stamp-a', '${USER_1}', '${STAND}');
    INSERT INTO ratings (id, user_id, stand_id, score) VALUES ('rating-a', '${USER_1}', '${STAND}', 4);
    INSERT INTO leads (id, scanner_user_id, scanned_user_id) VALUES ('lead-a', '${USER_1}', '${USER_2}');
    INSERT INTO access_logs (id, user_id, zone_id, action) VALUES ('log-a', '${USER_1}', '${ZONE}', 'ENTRY');
  `);
  assert.equal(userVersion(temp.sqlite), 4);
  return temp;
}

test('[US-06.1] una base en versión 4 migra a la 5 sin perder filas', async () => {
  const temp = await createVersion4Database();
  try {
    const before = tableCounts(temp.sqlite);
    const tagsBefore = plain(
      temp.sqlite.prepare('SELECT uid, type, user_id, stand_id, zone_id FROM nfc_tags ORDER BY uid').all(),
    );

    await runInitialize(temp.database, false);

    assert.equal(userVersion(temp.sqlite), 5);
    assert.deepEqual(tableCounts(temp.sqlite), before);

    const tagsAfter = temp.sqlite
      .prepare('SELECT id, uid, type, user_id, stand_id, zone_id FROM nfc_tags ORDER BY uid')
      .all();
    assert.deepEqual(
      tagsAfter.map(({ id, ...rest }) => rest),
      tagsBefore,
    );
    for (const tag of tagsAfter) {
      assert.match(tag.id, UUID_V4);
    }
    assert.equal(new Set(tagsAfter.map((tag) => tag.id)).size, tagsAfter.length);
  } finally {
    temp.cleanup();
  }
});

test('[US-06.1] nfc_tags usa id como clave primaria y uid como clave única', async () => {
  const temp = await createVersion4Database();
  try {
    await runInitialize(temp.database, false);

    const columns = temp.sqlite.prepare('PRAGMA table_info(nfc_tags)').all();
    assert.deepEqual(
      columns.filter((column) => column.pk > 0).map((column) => column.name),
      ['id'],
    );
    assert.throws(() =>
      temp.sqlite.exec(`
        INSERT INTO nfc_tags (id, uid, type, user_id)
        VALUES ('d4000000-0000-4000-8000-00000000ffff', 'tag-ana', 'USER_WRISTBAND', '${USER_2}');
      `),
    );
  } finally {
    temp.cleanup();
  }
});

test('[US-06.1] el seed local carga exactamente los mismos datos que supabase/seed.sql', async () => {
  const temp = createTempDatabase('your-way-demo-seed-');
  try {
    await runInitialize(temp.database, true);
    const local = (sql) => byId(temp.sqlite.prepare(sql).all());

    assert.deepEqual(
      local('SELECT id, name, email, role, company FROM users WHERE id LIKE \'d1%\''),
      byId(seedRows('users')),
    );
    assert.deepEqual(
      local(
        "SELECT id, name, max_capacity, current_capacity, required_role FROM zones WHERE id LIKE 'd2%'",
      ),
      byId(seedRows('zones')),
    );
    assert.deepEqual(
      local(
        "SELECT id, name, owner_id, map_x, map_y, evento_id, zone_id FROM stands WHERE id LIKE 'd3%'",
      ),
      byId(seedRows('stands')),
    );
    assert.deepEqual(
      local('SELECT id, uid, type, user_id, stand_id, zone_id FROM nfc_tags'),
      byId(seedRows('nfc_tags')),
    );

    const [seedEvento] = seedRows('eventos');
    assert.equal(seedEvento.id, DEMO_EVENTO.id);
    assert.ok(temp.sqlite.prepare('SELECT 1 FROM eventos WHERE id = ?').get(seedEvento.id));
  } finally {
    temp.cleanup();
  }
});

test('[US-06.1] el seed tiene la composición de la demo y UUID v4 válidos', () => {
  const roles = DEMO_USERS.reduce((count, user) => {
    count[user.role] = (count[user.role] ?? 0) + 1;
    return count;
  }, {});
  assert.deepEqual(roles, { ATTENDEE: 5, VIP: 2, STAFF: 2, EXHIBITOR: 1 });
  assert.deepEqual(
    DEMO_ZONES.map((zone) => zone.required_role).sort(),
    ['ATTENDEE', 'STAFF', 'VIP'],
  );
  assert.ok(DEMO_ZONES.every((zone) => zone.max_capacity > 0));
  assert.equal(DEMO_STANDS.length, 4);
  assert.ok(
    DEMO_STANDS.every(
      (stand) => stand.map_x >= 0 && stand.map_x <= 100 && stand.map_y >= 0 && stand.map_y <= 100,
    ),
  );

  const tagsOfType = (type) => DEMO_NFC_TAGS.filter((tag) => tag.type === type);
  assert.deepEqual(
    tagsOfType('USER_WRISTBAND').map((tag) => tag.user_id),
    DEMO_USERS.map((user) => user.id),
  );
  assert.deepEqual(
    tagsOfType('STAND_POINT').map((tag) => tag.stand_id),
    DEMO_STANDS.map((stand) => stand.id),
  );
  assert.deepEqual(
    tagsOfType('ZONE_CHECKPOINT').map((tag) => tag.zone_id),
    DEMO_ZONES.map((zone) => zone.id),
  );
  assert.equal(tagsOfType('USER_WRISTBAND')[9].uid, '04:A1:00:00:00:0A');
  assert.equal(tagsOfType('STAND_POINT')[0].uid, '04:B1:00:00:00:01');
  assert.equal(tagsOfType('ZONE_CHECKPOINT')[2].uid, '04:C1:00:00:00:03');

  const ids = [DEMO_USERS, DEMO_ZONES, DEMO_STANDS, DEMO_NFC_TAGS].flat().map((row) => row.id);
  for (const id of ids) {
    assert.match(id, UUID_V4);
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(DEMO_NFC_TAGS.map((tag) => tag.uid)).size, DEMO_NFC_TAGS.length);
});

test('[US-06.1] cargar el seed local dos veces no duplica filas', async () => {
  const temp = createTempDatabase('your-way-demo-seed-');
  try {
    await runInitialize(temp.database, true);
    const before = tableCounts(temp.sqlite);
    await seedDevData(temp.database);
    assert.deepEqual(tableCounts(temp.sqlite), before);
  } finally {
    temp.cleanup();
  }
});

test('[US-06.1] seed.sql es idempotente: cada INSERT usa ON CONFLICT (id) DO NOTHING', () => {
  const inserts = SEED_SQL.match(/^INSERT INTO /gm) ?? [];
  const guarded = SEED_SQL.match(/^ON CONFLICT \(id\) DO NOTHING;$/gm) ?? [];
  assert.equal(inserts.length, 5);
  assert.equal(guarded.length, inserts.length);
});
