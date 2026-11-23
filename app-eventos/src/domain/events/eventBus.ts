/**
 * Bus de eventos tipado en proceso (pub/sub) para comunicar módulos sin acoplarlos.
 * TypeScript puro: no depende de React Native ni de Expo.
 *
 * Reglas (contracts/domain-events.md → Reglas comunes):
 * - La entrega es síncrona: `publish` llama a los handlers en orden de suscripción.
 * - Un handler que lanza (o una promesa que rechaza) se registra con `console.warn`
 *   y no impide la entrega a los demás ni lanza al publicador.
 * - Los handlers deben ser idempotentes: la entrega es «al menos una vez».
 */

export type EventHandler<Payload> = (payload: Payload) => void | Promise<void>;

export type Unsubscribe = () => void;

export interface EventBus<EventMap extends object> {
  publish<Name extends keyof EventMap>(name: Name, payload: EventMap[Name]): void;
  subscribe<Name extends keyof EventMap>(
    name: Name,
    handler: EventHandler<EventMap[Name]>,
  ): Unsubscribe;
}

export function createEventBus<EventMap extends object>(): EventBus<EventMap> {
  const handlers = new Map<keyof EventMap, Set<EventHandler<never>>>();

  const reportFailure = (name: keyof EventMap, error: unknown) => {
    console.warn(`Un suscriptor de «${String(name)}» ha fallado.`, error);
  };

  return {
    publish(name, payload) {
      const subscribers = handlers.get(name);
      if (!subscribers) {
        return;
      }
      // Copia: suscribirse o desuscribirse durante la entrega no altera esta publicación.
      for (const handler of [...subscribers] as EventHandler<typeof payload>[]) {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            result.catch((error: unknown) => reportFailure(name, error));
          }
        } catch (error) {
          reportFailure(name, error);
        }
      }
    },

    subscribe(name, handler) {
      let subscribers = handlers.get(name);
      if (!subscribers) {
        subscribers = new Set();
        handlers.set(name, subscribers);
      }
      const stored = handler as EventHandler<never>;
      subscribers.add(stored);
      return () => {
        subscribers.delete(stored);
      };
    },
  };
}
