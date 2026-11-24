import assert from 'node:assert/strict';
import test from 'node:test';
import { NfcTagRepository } from '../src/database/NfcTagRepository.ts';
import { initializeAppDatabase } from '../src/database/initializeDatabase.ts';
import { NfcReadError } from '../src/domain/nfc/nfcReaderPort.ts';
import {
  encodeYourWayNdef,
  identifyTag,
  normalizeTagUid,
  parseYourWayNdef,
  resolveTag,
} from '../src/domain/nfc/nfcTag.ts';
import { scanTag } from '../src/domain/nfc/scanTag.ts';
import { createTempDatabase } from './sqliteHarness.mjs';

const NTAG_UID = '04A1B2C3D4E580';

function fakeReader(result) {
  return {
    getAvailability: async () => 'READY',
    readTag: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
    cancel: async () => {},
    openSettings: async () => {},
  };
}

function fakeRepository(rows = {}) {
  const recorded = [];
  return {
    recorded,
    findTag: async (uid) => rows[uid] ?? null,
    recordScan: async (record) => { recorded.push(record); },
  };
}

let idCounter = 0;
const deps = (reader, repository) => ({
  reader,
  repository,
  now: () => new Date('2026-11-24T10:00:00.000Z'),
  newId: () => `scan-${++idCounter}`,
});

async function createSeededDatabase() {
  const temp = createTempDatabase('your-way-nfc-');
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = true;
  try {
    await initializeAppDatabase(temp.database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
  return temp;
}

test('normalizeTagUid acepta UID con separadores y rechaza longitudes inválidas', () => {
  assert.equal(normalizeTagUid('04:a1:b2:c3:d4:e5:80'), NTAG_UID);
  assert.equal(normalizeTagUid('04 a1 b2 c3'), '04A1B2C3');
  assert.equal(normalizeTagUid('04A1B2'), null);
  assert.equal(normalizeTagUid('04A1B2C3D'), null);
  assert.equal(normalizeTagUid('tag-user-ana'), null);
  assert.equal(normalizeTagUid(''), null);
  assert.equal(normalizeTagUid(null), null);
});

test('el registro NDEF de Your Way se codifica y decodifica de ida y vuelta', () => {
  assert.equal(parseYourWayNdef(encodeYourWayNdef(NTAG_UID)), NTAG_UID);
  assert.equal(parseYourWayNdef('https://example.com'), null);
  assert.equal(parseYourWayNdef('yourway:w:no-hex'), null);
});

test('identifyTag prefiere el UID físico y usa NDEF como respaldo', () => {
  assert.deepEqual(
    identifyTag({ id: NTAG_UID, techTypes: [], ndefTexts: [encodeYourWayNdef('04000000')] }),
    { uid: NTAG_UID, source: 'HARDWARE' },
  );
  assert.deepEqual(
    identifyTag({ id: null, techTypes: [], ndefTexts: ['hola', encodeYourWayNdef(NTAG_UID)] }),
    { uid: NTAG_UID, source: 'NDEF' },
  );
  assert.equal(identifyTag({ id: null, techTypes: [], ndefTexts: ['hola'] }), null);
});

test('resolveTag clasifica por tipo y detecta filas incompletas', () => {
  const base = { uid: NTAG_UID, user_id: null, stand_id: null, zone_id: null };
  assert.deepEqual(resolveTag(NTAG_UID, null), { kind: 'UNKNOWN', uid: NTAG_UID });
  assert.deepEqual(
    resolveTag(NTAG_UID, { ...base, type: 'USER_WRISTBAND', user_id: 'u1' }),
    { kind: 'USER_WRISTBAND', uid: NTAG_UID, userId: 'u1' },
  );
  assert.deepEqual(
    resolveTag(NTAG_UID, { ...base, type: 'STAND_POINT', stand_id: 's1' }),
    { kind: 'STAND_POINT', uid: NTAG_UID, standId: 's1' },
  );
  assert.deepEqual(
    resolveTag(NTAG_UID, { ...base, type: 'ZONE_CHECKPOINT', zone_id: 'z1' }),
    { kind: 'ZONE_CHECKPOINT', uid: NTAG_UID, zoneId: 'z1' },
  );
  assert.equal(resolveTag(NTAG_UID, { ...base, type: 'STAND_POINT' }).kind, 'INCONSISTENT');
});

test('scanTag resuelve un tag conocido y registra la lectura', async () => {
  const repository = fakeRepository({
    [NTAG_UID]: { uid: NTAG_UID, type: 'USER_WRISTBAND', user_id: 'u1', stand_id: null, zone_id: null },
  });
  const outcome = await scanTag(
    deps(fakeReader({ id: '04:A1:B2:C3:D4:E5:80', techTypes: ['NfcA'], ndefTexts: [] }), repository),
  );
  assert.equal(outcome.ok, true);
  assert.equal(outcome.resolution.kind, 'USER_WRISTBAND');
  assert.equal(repository.recorded.length, 1);
  assert.equal(repository.recorded[0].uidSource, 'HARDWARE');
});

test('scanTag registra como UNREADABLE un tag sin UID ni NDEF de Your Way', async () => {
  const repository = fakeRepository();
  const outcome = await scanTag(deps(fakeReader({ id: null, techTypes: [], ndefTexts: [] }), repository));
  assert.deepEqual([outcome.ok, outcome.reason], [false, 'UNREADABLE']);
  assert.equal(repository.recorded[0].resolution, 'UNREADABLE');
});

test('scanTag no escribe nada si la lectura falla o se cancela', async () => {
  for (const reason of ['CANCELLED', 'TIMEOUT', 'FAILED']) {
    const repository = fakeRepository();
    const outcome = await scanTag(deps(fakeReader(new NfcReadError(reason, reason)), repository));
    assert.deepEqual(outcome, { ok: false, reason });
    assert.equal(repository.recorded.length, 0);
  }
});

test('con SQLite real: un tag nuevo es UNKNOWN, se vincula y se resuelve como pulsera', async () => {
  const temp = await createSeededDatabase();
  try {
    const repository = new NfcTagRepository(temp.database);
    const reader = fakeReader({ id: NTAG_UID, techTypes: ['NfcA'], ndefTexts: [] });

    const first = await scanTag(deps(reader, repository));
    assert.equal(first.resolution.kind, 'UNKNOWN');

    const candidates = await repository.listUsersWithoutWristband();
    assert.ok(candidates.length > 0);
    assert.ok(!candidates.some((user) => user.id === 'user-attendee-1'), 'Ana ya tiene pulsera');
    await repository.linkTestWristband(NTAG_UID, candidates[0].id);

    const second = await scanTag(deps(reader, repository));
    assert.deepEqual(second.resolution, {
      kind: 'USER_WRISTBAND',
      uid: NTAG_UID,
      userId: candidates[0].id,
    });

    const history = await repository.listRecentScans();
    assert.equal(history.length, 2);
    assert.deepEqual(history[0].techTypes, ['NfcA']);
  } finally {
    temp.cleanup();
  }
});
