import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventBus } from '../src/domain/events/eventBus.ts';

function silenceWarnings() {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  return { warnings, restore: () => { console.warn = original; } };
}

test('publish entrega el payload a todos los suscriptores del evento', () => {
  const bus = createEventBus();
  const received = [];
  bus.subscribe('Ping', (payload) => received.push(['a', payload.n]));
  bus.subscribe('Ping', (payload) => received.push(['b', payload.n]));
  bus.subscribe('Otro', () => received.push(['otro']));

  bus.publish('Ping', { n: 1 });

  assert.deepEqual(received, [['a', 1], ['b', 1]]);
});

test('unsubscribe deja de entregar solo a ese suscriptor y es idempotente', () => {
  const bus = createEventBus();
  const received = [];
  const unsubscribe = bus.subscribe('Ping', () => received.push('a'));
  bus.subscribe('Ping', () => received.push('b'));

  unsubscribe();
  unsubscribe();
  bus.publish('Ping', { n: 2 });

  assert.deepEqual(received, ['b']);
});

test('un handler que lanza no impide la entrega a los demás ni lanza al publicador', () => {
  const bus = createEventBus();
  const received = [];
  const console = silenceWarnings();
  try {
    bus.subscribe('Ping', () => { throw new Error('fallo del handler'); });
    bus.subscribe('Ping', () => received.push('b'));

    assert.doesNotThrow(() => bus.publish('Ping', { n: 3 }));
    assert.deepEqual(received, ['b']);
    assert.equal(console.warnings.length, 1);
  } finally {
    console.restore();
  }
});

test('un handler asíncrono que rechaza se registra sin romper la entrega', async () => {
  const bus = createEventBus();
  const received = [];
  const console = silenceWarnings();
  try {
    bus.subscribe('Ping', async () => { throw new Error('rechazo'); });
    bus.subscribe('Ping', () => received.push('b'));

    bus.publish('Ping', { n: 4 });
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(received, ['b']);
    assert.equal(console.warnings.length, 1);
  } finally {
    console.restore();
  }
});

test('suscribirse durante una publicación no recibe ese mismo evento', () => {
  const bus = createEventBus();
  const received = [];
  bus.subscribe('Ping', () => {
    received.push('a');
    bus.subscribe('Ping', () => received.push('tardío'));
  });

  bus.publish('Ping', { n: 5 });

  assert.deepEqual(received, ['a']);
});
