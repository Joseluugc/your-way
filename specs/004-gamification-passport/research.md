# Research: Motor de Gamificación, Pasaporte Digital y Valoración

Fase 0 de [plan.md](plan.md). Cada decisión resuelve una incógnita del contexto técnico o de integración. No queda ningún `NEEDS CLARIFICATION`.

## R1. Persistencia local

- **Decision**: `expo-sqlite` sobre la base existente `your-way-v2.db`, con una migración versionada nueva (nº 4) en el array `MIGRATIONS` de `src/database/initializeDatabase.ts`.
- **Rationale**: es el motor que ya usan mapa, eventos y notificaciones. Las migraciones con `PRAGMA user_version` ya resuelven las actualizaciones de instalaciones existentes, y los tests ejecutan el mismo SQL con `node:sqlite`. Decisión confirmada por el usuario.
- **Alternatives considered**: WatermelonDB (la constitución lo recomienda; requiere un development build, otro modelo de sincronización y una segunda base local); PowerSync (servicio adicional de pago).

## R2. Detección de conectividad

- **Decision**: `useNetworkState` de `expo-network`, siguiendo el patrón de `SyncProvider` (sincroniza al montar y al pasar de offline a online).
- **Rationale**: ya está instalado y probado en el repo.
- **Alternatives considered**: `@react-native-community/netinfo` (misma función, dependencia nueva).

## R3. Backend central

- **Decision**: Supabase (PostgreSQL) directo desde el cliente: tablas con `UNIQUE`, RLS para `authenticated` (sesión anónima vía `ensureSession()`) y views SQL `faction_scores` y `stand_ranking` para los agregados.
- **Rationale**: no existe un API Node en el repo. La idempotencia y los agregados se resuelven en la propia base de datos sin desplegar nada más.
- **Alternatives considered**: API Node.js delante de Supabase (más infraestructura sin un requisito que lo justifique; se puede añadir después detrás de `GamificationRemotePort` sin tocar el dominio).

## R4. Framework de tests

- **Decision**: `node:test` + `node:sqlite` (`npm run test:domain`). Unitarias de dominio con reloj y RNG inyectados; integración offline de los casos de uso sobre SQLite real con el adaptador `openDatabase` de `tests/mapOfflineSync.test.mjs`; sync con un `GamificationRemotePort` en memoria que simula fallos y reintentos.
- **Rationale**: es el runner actual, no necesita configuración y ya ejecuta TypeScript con `--experimental-strip-types`.
- **Alternatives considered**: Jest (preset de RN pesado y doble configuración), Vitest (dependencia nueva para el mismo resultado).

## R5. Comunicación entre módulos

- **Decision**: bus de eventos tipado y en proceso en `src/shared/events/eventBus.ts` (`publish<E>`, `subscribe<E>` → `unsubscribe`), sobre un mapa `EventMap` de nombre a payload. Los payloads llevan versión (`v: 1`). Entrega síncrona al menos una vez: un handler que falla no corta a los demás y se registra con `console.warn`.
- **Rationale**: cumple la petición de no acoplar módulos, es TS puro (testeable en Node) y los módulos de Hugo todavía no existen, así que se pueden simular publicando en el bus.
- **Alternatives considered**: llamadas directas entre módulos (acoplamiento), `DeviceEventEmitter` de RN (no se puede usar en el dominio ni en Node), una librería de bus como mitt (dependencia sin necesidad).

## R6. Idempotencia de la sincronización

- **Decision**: cada fila se crea con un UUID v4 en el cliente (reutilizando el patrón `crypto.randomUUID` de `src/domain/map/manageStand.ts`). En remoto hay claves únicas naturales y la subida usa `upsert(rows, { onConflict: <clave>, ignoreDuplicates: true })`, que supabase-js traduce a `INSERT … ON CONFLICT DO NOTHING`. Las filas se marcan `synced = 1` solo cuando el envío confirma.
- **Rationale**: un reintento tras un corte reenvía las mismas filas con los mismos IDs, y la clave natural cubre además el caso extremo de dos IDs distintos para el mismo hecho.
- **Alternatives considered**: deduplicar en un RPC del servidor (más lógica remota), `upsert` con actualización (rompería la inmutabilidad del libro mayor).

## R7. Libro mayor de XP

- **Decision**: `xp_transactions` append-only con `UNIQUE(source_type, reference_id)`. El total de un usuario o una facción es siempre `SUM(final_xp)`. En local, triggers `BEFORE UPDATE` / `BEFORE DELETE` con `RAISE(ABORT)`, excepto la marca `synced`. En remoto no hay policies de UPDATE ni DELETE. `reference_id` apunta al hecho que la origina (sello, trivia = id del sello, valoración, logro, tirada).
- **Rationale**: consistencia offline sin conflictos de último-escritor-gana; el marcador de facción es una suma auditable (SC-004).
- **Alternatives considered**: contador `total_xp` en el usuario (se pierden incrementos al fusionar dispositivos y no se puede auditar).
- **Nota**: el trigger local de UPDATE solo permite cambiar `synced` (`WHEN` que compara el resto de columnas).

## R8. Momento en que se fija el multiplicador de zona

- **Decision**: `handleZoneOccupancyChanged` mantiene una caché `zone_occupancy_cache(zone_id, level, updated_at)` en SQLite. `handleStandScanned` lee el nivel de la zona del estand en ese momento y guarda `zone_level_at_scan` y `applied_multiplier` en el sello. La trivia reutiliza el multiplicador guardado, aunque la zona cambie mientras se responde.
- **Rationale**: cumple el edge case "multiplicador vigente en el instante del escaneo" y es reproducible tras reiniciar la app.
- **Alternatives considered**: recalcular al responder (inconsistente); consultar al módulo de Mapa en cada escaneo (acoplamiento).
- **Mapeo**: `GREEN` ≙ `OccupancyLevel 'available'` (< 70 %) de `src/domain/map/calculateZoneOccupancy.ts`. `'unavailable'` o una zona sin nivel en caché da ×1.0.

## R9. Cooldown de las Misiones Relámpago

- **Decision**: tabla local `flash_mission_alerts(zone_id PK, last_sent_at)`. Función pura `shouldNotify(previousLevel, level, lastSentAt, now, cooldownMs = 20 min)`: solo notifica en la transición a `available` y si `now - lastSentAt ≥ 20 min`.
- **Rationale**: persiste entre reinicios y es testeable con un reloj falso.
- **Alternatives considered**: cooldown solo en memoria (se pierde al reiniciar y la zona notificaría dos veces).

## R10. Ruleta

- **Decision**: `RandomPort` inyectable (`next(): number` en [0, 1)). `pickReward(weights, r)` sobre pesos acumulados. Los pesos se validan como enteros ≥ 0 que suman 100; si no, se usan los valores por defecto (40/30/20/10). La tirada se resuelve y persiste **antes** de la animación, que solo representa el resultado guardado. `spinsUnlocked = floor(stampCount / X)` y cada múltiplo crea una fila `PENDING` con `trigger_stamp_count` único.
- **Rationale**: es testeable con RNG determinista (SC-005 con 1 000 tiradas), y cerrar la app durante la animación no permite volver a tirar.
- **Alternatives considered**: decidir el premio al terminar la animación (permite repetir cerrando la app).

## R11. Multiplicadores combinados

- **Decision**: `multiplier = zone (2.0 | 1.0) × personal (1.5 | 1.0)` solo para `STAMP` y `TRIVIA`. `final_xp = round(base_xp × multiplier)`. El ×1.5 personal se consume en el primer sello nuevo tras obtenerlo (la tirada pasa de `SPUN` a `CONSUMED` en la misma transacción SQLite).
- **Rationale**: es lo que fija la spec en *Assumptions*.

## R12. Insignias

- **Decision**: `evaluateAchievements(snapshot, alreadyUnlocked, eventStart)` es pura y recibe sellos (con `scanned_at` y la zona de cada estand), valoraciones y el número de estands por zona. Se ejecuta después de cada sello o valoración, dentro de la misma transacción.
  - `EARLY_BIRD`: el primer sello tiene `scanned_at − evento.fecha_inicio ∈ [0, 15 min]`.
  - `EXPERT_CRITIC`: hay 5 o más `stand_ratings` distintos.
  - `SECTOR_EXPLORER`: existe una zona con ≥ 1 estand y todos sus estands sellados.
  - `SPEEDRUNNER`: hay 3 sellos consecutivos (ordenados por `scanned_at`) con `t[i+2] − t[i] ≤ 5 min`.
- **Rationale**: es determinista y no necesita red, y el `UNIQUE` evita que se desbloquee dos veces.

## R13. Media bayesiana del ranking

- **Decision**: `score = (v·R + m·C) / (v + m)` con `m = 5` y `C` = media de todas las valoraciones del evento. Orden: `score` desc, `v` desc, nombre asc. Se calcula en la view remota `stand_ranking` y se replica en la caché local `ranking_cache`; la función pura `bayesianScore` se usa en tests y como respaldo local.
- **Rationale**: cumple el escenario US5-1 (un único 5 ★ no supera a un estand con muchas valoraciones altas).

## R14. Asociación estand → zona

- **Decision**: añadir `stands.zone_id` (nullable, FK a `zones`) en local (migración nº 4) y en remoto (`0002`). Un estand sin zona nunca recibe ×2 y no cuenta para `SECTOR_EXPLORER`.
- **Rationale**: el modelo actual (`Stand` en `mapTypes.ts`) no relaciona estands con zonas y dos requisitos lo necesitan.
- **Coordinación**: el campo pertenece al modelo del Mapa (Rafa). La UI para asignar la zona al crear o editar un estand se acuerda con Rafa/Joselu; mientras tanto, el seed de dev la rellena.

## R15. Feedback háptico

- **Decision**: el módulo solo publica `HapticFeedbackRequested`. El adaptador (p. ej. `expo-haptics`) pertenece al módulo de Accesibilidad (Javi). Si no hay suscriptor, no ocurre nada.
- **Rationale**: no añade dependencias y respeta la separación de responsabilidades.

## R16. Identidad del asistente

- **Decision**: el `userId` del asistente viene del payload de los eventos NFC (`StandNfcScanned.userId`), que lo resuelve el módulo de Hugo a partir de la pulsera vinculada. La sesión Supabase anónima solo habilita RLS, igual que en `eventos`.
- **Riesgo**: con RLS `authenticated → true`, cualquier cliente autenticado podría insertar filas de otro usuario. Es aceptable para la asignatura y está alineado con el resto del repo; endurecerlo (vincular `users.id` a `auth.uid()`) queda fuera de alcance.
