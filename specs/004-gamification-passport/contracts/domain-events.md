# Contrato: Eventos de dominio del módulo de Gamificación

Los eventos viajan por el bus tipado en proceso `app-eventos/src/shared/events/eventBus.ts`. Los tipos se exportan desde `app-eventos/src/modules/gamification/domain/events.ts` (TS puro), y otros módulos pueden importar **solo** esos tipos.

## Reglas comunes

- Todos los payloads llevan `v: 1`. Un cambio incompatible crea `v: 2` y se mantiene `v: 1` durante una iteración.
- Las fechas son strings ISO 8601 en UTC.
- La entrega es en proceso y **al menos una vez**: todos los handlers son idempotentes. Si un handler lanza un error, no impide la entrega a los demás; se registra con `console.warn`.
- `publish` es síncrono respecto a la entrega; un handler asíncrono maneja sus propios errores.

```ts
export interface EventBusPort {
  publish<K extends keyof DomainEventMap>(name: K, payload: DomainEventMap[K]): void;
  subscribe<K extends keyof DomainEventMap>(
    name: K,
    handler: (payload: DomainEventMap[K]) => void | Promise<void>,
  ): () => void; // unsubscribe
}
```

## Eventos de entrada (los consume Gamificación)

### `AttendeeWristbandWritten` — productor: NFC Puerta (Hugo)
```ts
interface AttendeeWristbandWritten {
  v: 1;
  userId: string;       // asistente vinculado a la pulsera
  eventoId: string;
  wristbandUid: string; // UID NDEF de la pulsera
  writtenAt: string;
}
```
**Efecto**: `assignFaction`. Si ya existe `attendee_factions(userId, eventoId)`, no hace nada.

### `StandNfcScanned` — productor: Lectura NFC (Hugo)
```ts
interface StandNfcScanned {
  v: 1;
  userId: string;   // asistente que escanea (resuelto por el módulo NFC)
  standId: string;  // resuelto a partir de nfc_tags (type = 'STAND_POINT')
  tagUid: string;
  scannedAt: string;
}
```
**Efecto**: `handleStandScanned`, que devuelve al presentador uno de:
- `{ kind: 'NEW_STAMP', stamp, xp, trivia | null, unlockedAchievements, newSpins }`
- `{ kind: 'ALREADY_VISITED', stamp, rating | null }`
- `{ kind: 'UNKNOWN_STAND' }`

Para que la UI pueda abrir `StampFlowModal`, el resultado también se publica internamente como `StampFlowRequested` (evento interno del módulo, no forma parte del contrato).

### `ZoneOccupancyChanged` — productor: Mapa/Aforo (Rafa)
```ts
type OccupancyLevel = 'available' | 'medium' | 'full' | 'unavailable'; // de src/domain/map/mapTypes.ts

interface ZoneOccupancyChanged {
  v: 1;
  zoneId: string;
  zoneName: string;
  previousLevel: OccupancyLevel | null;
  level: OccupancyLevel;
  occurredAt: string;
}
```
**Productor sugerido**: después de cada `syncMapAndOccupancy` o recálculo de `calculateZoneOccupancy`, comparar el `level` anterior y el nuevo de cada zona y publicar solo si cambia.
**Efecto**: `handleZoneOccupancyChanged` actualiza `zone_occupancy_cache`. Si `level === 'available'` y `previousLevel !== 'available'` y ha pasado el cooldown de 20 min, publica `FlashMissionAlertRequested`.

## Eventos de salida (los publica Gamificación)

### `FlashMissionAlertRequested` — consumidor: Notificaciones (Rafa)
```ts
interface FlashMissionAlertRequested {
  v: 1;
  alertId: string;      // UUID; sirve para deduplicar en el consumidor
  zoneId: string;
  zoneName: string;
  multiplier: 2;
  requestedAt: string;
}
```
**Expectativa**: notificación local con un texto del tipo «⚡ Misión Relámpago: la zona {zoneName} está tranquila, ¡sellos ×2!», que se puede guardar en `cached_notifications` como `CAPACITY_ALERT` con `related_zone_id = zoneId`.

### `HapticFeedbackRequested` — consumidor: Accesibilidad (Javi)
```ts
interface HapticFeedbackRequested {
  v: 1;
  kind: 'STAMP_SUCCESS' | 'ACHIEVEMENT_UNLOCKED' | 'ROULETTE_WIN';
  requestedAt: string;
}
```
**Cuándo**: `STAMP_SUCCESS` al crear un sello nuevo (< 200 ms desde el escaneo); `ACHIEVEMENT_UNLOCKED` una vez por insignia desbloqueada; `ROULETTE_WIN` cuando la tirada tiene resultado (al terminar la animación). El consumidor decide el patrón de vibración y respeta los ajustes de accesibilidad del usuario.

### `StandRatingSubmitted` — consumidor: Dashboard (Joselu)
```ts
interface StandRatingSubmitted {
  v: 1;
  ratingId: string;
  userId: string;
  standId: string;
  eventoId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  submittedAt: string;
}
```
**Cuándo**: después de persistir en local la valoración (aunque no haya red). El consumidor refresca su vista mediante `IRankingProjectionPort`.
