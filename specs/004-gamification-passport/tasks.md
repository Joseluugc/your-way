---

description: "Lista de tareas de implementación: Motor de Gamificación, Pasaporte Digital y Valoración"
---

# Tasks: Motor de Gamificación, Pasaporte Digital y Valoración

**Input**: Documentos de diseño en `specs/004-gamification-passport/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: SÍ. El plan exige pruebas unitarias y de integración offline (`node:test` + `node:sqlite`, `npm run test:domain`). En cada historia los tests se escriben primero y deben fallar antes de implementar.

**Organization**: tareas agrupadas por historia de usuario para poder implementarlas y probarlas por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (ficheros distintos, sin dependencias pendientes)
- **[Story]**: historia de la spec (US1…US5)

## Convenciones de rutas y código

- Todas las rutas de código son relativas a `app-eventos/`, salvo `supabase/` y `schema.sql`, que están en la raíz del repo.
- Módulo: `src/modules/gamification/{domain,application,infrastructure,presentation}/`.
- `domain/` y `application/` en TS puro: **ningún import de `react-native`, `expo-*` ni `@supabase/*`**. Los imports relativos llevan extensión `.ts` explícita (requisito de `node --experimental-strip-types`, `allowImportingTsExtensions` ya activo).
- Los tests viven en `tests/*.test.mjs` (el glob de `test:domain` no entra en subcarpetas) y reutilizan el arnés `openDatabase` de `tests/mapOfflineSync.test.mjs` (adaptador `node:sqlite` `DatabaseSync` → API de `expo-sqlite`).
- Código, comentarios y UI en español; TS `strict` sin `any`. Commits: `implementar X [US-04.N]`.

> **Nota de rutas (2026-11-27):** la Fase 1–2 se implementó con la estructura plana del proyecto, no con `src/modules/gamification/`. Equivalencias: `domain/**` → `src/domain/gamification/`, `application/**` → `src/domain/gamification/` (puertos en `ports.ts`), `infrastructure/sqlite/SqliteGamificationRepository.ts` → `src/database/GamificationRepository.ts`, `infrastructure/systemAdapters.ts` → `src/lib/systemAdapters.ts`, `src/shared/events/eventBus.ts` → `src/domain/events/eventBus.ts`, `presentation/screens` → `src/screens/`, `presentation/components` → `src/components/`, `presentation/hooks` → `src/hooks/`. Las tareas antiguas conservan las rutas originales: aplicar esta tabla al implementarlas.

---

## Mis issues (Samu)

Solo estas tareas salen de las issues de GitHub asignadas. El resto del fichero queda en «Fuera de mis issues».

### TASK-09 (#9): Spec 04 - Requisitos de Gamificación y Feedback

- [X] Redactar la Spec 04: `specs/04-gamificacion-pasaporte.md` y `specs/004-gamification-passport/` (spec, plan, research, data-model, contracts, quickstart y este `tasks.md`). Falta cerrar la issue en GitHub.

### TASK-10 (#10): UI del Pasaporte Digital de Sellos

La define `specs/09-pasaporte-digital-sellos-ui.md` (plan de implementación de 7 pasos y criterios de aceptación). Se implementa con `/spec-impl 09-pasaporte-digital-sellos-ui`. Sustituye a la antigua T032.

- [X] S09 Implementar la Spec 09: view model y mock en `src/domain/gamification/`, componentes en `src/components/`, `src/screens/PassportScreen.tsx` y la ruta `src/app/(tabs)/pasaporte.tsx`

### TASK-23 (#32): Dominio del Pasaporte y Repositorio de Valoraciones

**Depende de:** TASK-15 (IDs UUID en SQLite) y TASK-09.

**Esquema:** la issue cita `ratings.score` y `sync_status = 'pending'`, que son del esquema antiguo. Se trabaja sobre `stand_ratings` (migración nº 4): `score` equivale a `stars` y «pendiente» equivale a `synced = 0`. `stand_ratings` ya tiene `UNIQUE(user_id, stand_id)`, así que la regla es **una valoración por estand** (Spec 04, FR-005), inmutable.

**Umbral de recompensa:** `DEFAULT_SPIN_EVERY_N_STAMPS = 3` de `src/domain/gamification/types.ts` (Spec 04, US-04.3: una tirada de ruleta cada 3 sellos), o `gamification_config.spin_every_n_stamps` si el evento lo configura.

- [ ] T079 [P] [TASK-23] Tests de dominio en `tests/gamificationPassport.test.mjs`: `computePassport` (0 estands → 0 %; 3 de 8 sellados → 3 sellados, 5 pendientes y 38 %; sellos de otro evento ignorados), umbral de recompensa (2 sellos → no desbloqueada, 3 → sí, 6 → 2 recompensas ganadas, `spinEveryN` configurable), `validateStars` (acepta 1..5 enteros y rechaza 0, 6 y 3.5) y `assertCanRate` (sin sello → `STAND_NOT_STAMPED`, con valoración previa → `ALREADY_RATED`). Deben fallar antes de T020 y T080
- [ ] T020 [P] [TASK-23] Implementar `src/domain/gamification/rating.ts`: `validateStars(n): n is 1|2|3|4|5` y `assertCanRate(stamp | null, existingRating | null)` (sin sello → error `STAND_NOT_STAMPED`; con valoración previa → `ALREADY_RATED`). Movida aquí desde la Fase 3
- [ ] T080 [P] [TASK-23] Implementar `src/domain/gamification/passport.ts`, sin imports de React Native ni Expo: `computePassport({ stands, stamps, ratings, spinEveryN })` devuelve los estands sellados y pendientes del usuario, `{ conseguidos, total, porcentaje }` (reutiliza `calcularProgreso` de `src/domain/gamification/passportView.ts`, Spec 09), `recompensasGanadas = Math.floor(conseguidos / spinEveryN)`, `recompensaDesbloqueada = recompensasGanadas > 0` y los estands sellados sin valorar. Incluye `toPassportViewData(...)`, que produce el `PassportViewData` de la Spec 09 (depende de S09)
- [ ] T081 [TASK-23] Crear `src/database/RatingRepository.ts` sobre `stand_ratings` (import solo de tipo de `expo-sqlite`): `rateStand({ userId, standId, stars })` genera el id con `cryptoIds` de `src/lib/systemAdapters.ts` (UUID v4), valida con `validateStars` y `assertCanRate` (lee el sello de `user_stamps` y la valoración previa) e inserta con `synced = 0`; además `getRating(userId, standId)` y `listRatings(userId, eventoId)`. `GamificationRepository.ts` delega en él sus métodos de valoración para no duplicar SQL (depende de T020)
- [ ] T082 [P] [TASK-23] Test de integración en `tests/ratingRepository.test.mjs` con `tests/sqliteHarness.mjs`: valorar un estand sellado guarda 1 fila con id UUID v4, `stars` 1..5 y `synced = 0`; `stars = 0` o `6` lanza un error y no inserta; valorar sin sello lanza `STAND_NOT_STAMPED`; una segunda valoración lanza `ALREADY_RATED` y deja 1 sola fila
- [ ] T083 [TASK-23] Ejecutar desde `app-eventos/` `npm run lint`, `npx tsc --noEmit` y `npm run test:domain` en verde (depende de T079–T082)

---

# Fuera de mis issues

Lo que sigue no lo piden mis issues de GitHub. Se conserva sin cambios como referencia del diseño completo de la Spec 04 (otro integrante o un sprint futuro).

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: esqueleto del módulo y utilidades de test.

- [X] T001 Crear la estructura de carpetas `src/modules/gamification/{domain/{xp,stamp,trivia,rating,achievements,roulette,ranking,faction,flashMission},application/{ports,useCases},infrastructure/{sqlite,supabase,events},presentation/{hooks,screens,components}}` y `src/shared/events/`, cada una con un `README.md` de una línea que indique la capa y su regla de dependencias (plan.md → Structure Decision)
- [X] T002 [P] Extraer el arnés `openDatabase(path)` de `tests/mapOfflineSync.test.mjs` a `tests/helpers/sqliteHarness.mjs` (exporta `openDatabase` y `createTempDatabase()`, que devuelve `{ database, cleanup }`) y hacer que `tests/mapOfflineSync.test.mjs` lo importe sin cambiar su comportamiento
- [X] T003 [P] Crear los dobles de test en `tests/helpers/gamificationFakes.mjs`: `FakeClock` (`now()` controlable y `advance(ms)`), `SeededRandom` (mulberry32 con `next(): number` en [0, 1)), `SequentialIds` (UUID v4 deterministas), `RecordingEventBus` (registra los `publish`) e `InMemoryRemote` (implementa `GamificationRemotePort` y permite configurar fallos por llamada)

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: bus de eventos, tipos, puertos, esquema local/remoto y repositorio base, que usan todas las historias.

**⚠️ CRITICAL**: no se puede empezar ninguna historia hasta terminar esta fase.

### Tests de la fundación

- [X] T004 [P] Test del bus en `tests/eventBus.test.mjs`: `publish` entrega a todos los suscriptores, `unsubscribe` deja de entregar y un handler que lanza un error no impide la entrega a los demás
- [X] T005 [P] Test de la migración nº 4 en `tests/gamificationMigration.test.mjs`: sobre una BD con `user_version = 3` y filas en `stamps`/`ratings`, `initializeAppDatabase` crea todas las tablas de data-model.md, copia `stamps → user_stamps` (`trivia_result = 'SKIPPED'`, `applied_multiplier = 1.0`, `synced = 1`) y `ratings → stand_ratings` (`stars = score`, `synced = 1`), no crea ninguna fila en `xp_transactions`, es idempotente si se ejecuta dos veces y los triggers impiden `DELETE` y `UPDATE` de `xp_transactions` salvo el cambio exclusivo de `synced`

### Implementación de la fundación

- [X] T006 [P] Implementar el bus tipado en proceso en `src/shared/events/eventBus.ts`: `createEventBus<EventMap>()` con `publish(name, payload)` y `subscribe(name, handler) → unsubscribe`; entrega síncrona, captura los errores por handler con `console.warn` y no lanza al publicador (contracts/domain-events.md → Reglas comunes)
- [X] T007 [P] Definir en `src/modules/gamification/domain/events.ts` los tipos versionados `v: 1` de los 6 eventos de contracts/domain-events.md (`AttendeeWristbandWritten`, `StandNfcScanned`, `ZoneOccupancyChanged`, `FlashMissionAlertRequested`, `HapticFeedbackRequested` con `kind: 'STAMP_SUCCESS' | 'ACHIEVEMENT_UNLOCKED' | 'ROULETTE_WIN'`, `StandRatingSubmitted` con `stars: 1 | 2 | 3 | 4 | 5`) y el mapa `GamificationEventMap`; reutilizar `OccupancyLevel` de `src/domain/map/mapTypes.ts` (import solo de tipo)
- [X] T008 [P] Definir las entidades y value objects compartidos en `src/modules/gamification/domain/types.ts`: `XpSource = 'STAMP' | 'TRIVIA' | 'RATING' | 'ACHIEVEMENT' | 'ROULETTE'`, `TriviaResult = 'PENDING' | 'CORRECT' | 'WRONG' | 'TIMEOUT' | 'SKIPPED'`, `AchievementCode = 'EARLY_BIRD' | 'EXPERT_CRITIC' | 'SECTOR_EXPLORER' | 'SPEEDRUNNER'`, `RouletteReward = 'XP_200' | 'MULTIPLIER_1_5' | 'RAFFLE_TICKET' | 'PHYSICAL_PRIZE'`, `SpinStatus = 'PENDING' | 'SPUN' | 'CONSUMED' | 'CLAIMED'` e interfaces `PassportStamp`, `StandTrivia`, `StandRating`, `XpTransaction`, `UserAchievement`, `RouletteSpin`, `Faction`, `GamificationConfig`, con los campos de data-model.md
- [X] T009 [P] Implementar en `src/modules/gamification/domain/xp/xpLedger.ts` las constantes `BASE_XP = { STAMP: 100, TRIVIA: 50, RATING: 25, ROULETTE_XP: 200 }`, `ACHIEVEMENT_XP = { EARLY_BIRD: 150, EXPERT_CRITIC: 200, SECTOR_EXPLORER: 300, SPEEDRUNNER: 250 }` y `createXpTransaction({ id, userId, factionId, eventoId, sourceType, referenceId, baseXp, multiplier, createdAt })`, que calcula `final_xp = Math.round(base_xp × multiplier)`, exige `base_xp > 0` y `multiplier ≥ 1` y fuerza `multiplier = 1` para `RATING`, `ACHIEVEMENT` y `ROULETTE`
- [X] T010 Definir los puertos en `src/modules/gamification/application/ports/`: `ClockPort.ts` (`now(): Date`), `RandomPort.ts` (`next(): number`), `IdGeneratorPort.ts` (`uuid(): string`), `EventBusPort.ts` (tipado con `GamificationEventMap`), `GamificationRepositoryPort.ts` (lectura/escritura transaccional de todas las tablas del módulo + `withTransaction(fn)`), `GamificationRemotePort.ts` (`upload<Tabla>(rows)` y `download<Recurso>(eventoId)` según contracts/supabase-sync.md) e `IRankingProjectionPort.ts` (copiar literalmente de contracts/ranking-projection-port.md) (depende de T007, T008)
- [X] T011 Añadir la migración nº 4 al final de `MIGRATIONS` en `src/database/initializeDatabase.ts` (sin editar las publicadas): `ALTER TABLE stands ADD COLUMN zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL`; `CREATE TABLE` de `factions` (`UNIQUE(evento_id, name)`, `color_hex` con `CHECK` de `#RRGGBB`), `attendee_factions` (`UNIQUE(user_id, evento_id)`), `stand_trivia` (`stand_id UNIQUE`, `correct_option_index CHECK BETWEEN 0 AND 2`, `bonus_xp INTEGER NOT NULL DEFAULT 50 CHECK (bonus_xp > 0)`), `user_stamps` (`UNIQUE(user_id, stand_id)`, `trivia_result CHECK IN ('PENDING','CORRECT','WRONG','TIMEOUT','SKIPPED')`, `applied_multiplier REAL NOT NULL`), `stand_ratings` (`stars CHECK BETWEEN 1 AND 5`, `UNIQUE(user_id, stand_id)`), `xp_transactions` (`UNIQUE(source_type, reference_id)`), `user_achievements` (`UNIQUE(user_id, evento_id, code)`), `roulette_spins` (`UNIQUE(user_id, evento_id, trigger_stamp_count)`, `status CHECK IN ('PENDING','SPUN','CONSUMED','CLAIMED')`), `gamification_config`, `zone_occupancy_cache`, `flash_mission_alerts`, `ranking_cache` y `faction_score_cache`, todas las sincronizables con `synced INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0,1))`; índices por `user_id`, `stand_id` y `synced`; triggers `xp_transactions_no_delete` y `xp_transactions_only_synced_update` con `RAISE(ABORT, …)`; copia de `stamps`/`ratings` según data-model.md → Migraciones (depende de T005)
- [X] T012 [P] Añadir `zone_id: UUID | null` a `Stand` en `src/domain/map/mapTypes.ts` y propagarlo en `src/database/MapRepository.ts`, `src/domain/map/mapMockData.ts` (asignar cada estand mock a una zona mock) y `src/sync/supabaseMapDataSource.ts` (incluirlo en el select y el upsert); actualizar `tests/mapManagement.test.mjs` y `tests/mapOfflineSync.test.mjs` si comparan objetos `Stand` completos (coordinar con Rafa, research.md R14)
- [X] T013 Crear la migración remota `supabase/migrations/0002_gamification.sql`: `stands.zone_id`; las mismas tablas sin `synced`, con FKs, `CHECK` y `UNIQUE` (`TIMESTAMPTZ`, `JSONB` para `options_json` y `roulette_weights_json`, `NUMERIC(4,2)` para multiplicadores); copia `stamps → user_stamps` y `ratings → stand_ratings` con `ON CONFLICT DO NOTHING`; `ENABLE ROW LEVEL SECURITY` + policies `SELECT`/`INSERT` `TO authenticated` en todas y `UPDATE` solo en `user_stamps` y `roulette_spins`; ninguna policy de `DELETE`. Reflejar los mismos cambios en `schema.sql` (depende de T011)
- [X] T014 Implementar `SqliteGamificationRepository` en `src/modules/gamification/infrastructure/sqlite/SqliteGamificationRepository.ts`, que implementa `GamificationRepositoryPort` sobre `SQLiteDatabase` (import solo de tipo de `expo-sqlite`): `withTransaction`, `getStand(standId)` (con `zone_id` y `evento_id`), `getEvento(eventoId)`, `getAttendeeFaction`, `getStamp(userId, standId)`, `listStamps(userId, eventoId)`, `insertStamp`, `getTrivia(standId)`, `getRating`, `insertRating`, `listRatings`, `insertXpTransaction` (`INSERT OR IGNORE`), `sumXp(userId, eventoId)`, `getConfig(eventoId)` (usa los valores por defecto si no hay fila), `getZoneLevel(zoneId)`, `listPending<Tabla>()` y `markSynced(tabla, ids)` (depende de T010, T011)
- [X] T015 [P] Implementar los adaptadores de sistema en `src/modules/gamification/infrastructure/systemAdapters.ts`: `systemClock`, `mathRandom` y `cryptoIds` (reutilizar el patrón `crypto.randomUUID` con fallback de `src/domain/map/manageStand.ts:67`)
- [X] T016 Crear `src/modules/gamification/application/registerGamificationModule.ts` (`registerGamificationModule(deps) → unregister`, que de momento solo guarda las dependencias; cada historia añade su suscripción) y `src/providers/GamificationProvider.tsx` (construye bus, repositorio y adaptadores con `useSQLiteContext`, registra el módulo, expone `useGamification()` con `{ bus, useCases }` y lanza un error si se usa fuera del provider). Montarlo en `src/app/_layout.tsx` dentro de `SQLiteProvider`, después de `SyncProvider` (depende de T006, T014, T015)

**Checkpoint**: `npm run test:domain` en verde con T004–T005; esquema y puertos listos.

---

## Phase 3: User Story 1 - Sellado NFC, Micro-Trivia y Valoración (Priority: P1) 🎯 MVP

**Goal**: el primer escaneo de un estand crea un sello único (100 XP), lanza una trivia de 3 opciones y 15 s (+50 XP si se acierta) y pide una valoración de 1–5 ★ (+25 XP). El reescaneo muestra la valoración previa sin duplicar nada. Todo funciona offline.

**Independent Test**: en modo avión, publicar `StandNfcScanned` desde el panel de dev, completar trivia y valoración y comprobar el sello, la suma de XP (175 si se acierta) y la valoración en el pasaporte; al reescanear, «Ya visitado» sin cambios (quickstart.md escenarios 2–4).

### Tests for User Story 1 ⚠️

- [ ] T017 [P] [US1] Tests de dominio en `tests/gamificationStamp.test.mjs`: `evaluateTriviaAnswer` (correcta dentro de 15 000 ms → `CORRECT`; incorrecta → `WRONG`; `elapsedMs > 15 000` → `TIMEOUT` aunque sea correcta), `validateStars` (acepta 1..5 enteros y rechaza 0, 6 y 3.5), `validateTrivia` (exactamente 3 opciones no vacías, `question` ≤ 200 caracteres, índice 0..2) y `createXpTransaction` (redondeo, multiplicador forzado a 1 en `RATING`)
- [ ] T018 [P] [US1] Test de integración offline en `tests/gamificationStampFlow.test.mjs` sobre SQLite real con `InMemoryRemote` desconectado: primer escaneo → `NEW_STAMP`, 1 fila en `user_stamps` con `trivia_result = 'PENDING'` y 1 `xp_transactions` `STAMP` de 100; `answerTrivia` correcta → +50 `TRIVIA`; segunda respuesta → error de dominio sin XP extra; `submitRating(4)` → +25 `RATING` y publica `StandRatingSubmitted`; reescaneo → `ALREADY_VISITED` con `rating.stars = 4` y sin filas nuevas; tag de un estand inexistente → `UNKNOWN_STAND`; estand sin trivia → `trivia_result = 'SKIPPED'`; todas las filas con `synced = 0`; `HapticFeedbackRequested{STAMP_SUCCESS}` publicado una sola vez

### Implementation for User Story 1

- [ ] T019 [P] [US1] Implementar `src/modules/gamification/domain/trivia/trivia.ts`: `TRIVIA_TIME_LIMIT_MS = 15_000`, `validateTrivia(trivia)` y `evaluateTriviaAnswer(trivia, selectedIndex | null, elapsedMs): 'CORRECT' | 'WRONG' | 'TIMEOUT'`
- T020 movida a «Mis issues» (TASK-23).
- [ ] T021 [P] [US1] Implementar `src/modules/gamification/domain/stamp/stamp.ts`: `decideScan(stand | null, existingStamp | null): 'UNKNOWN_STAND' | 'ALREADY_VISITED' | 'NEW_STAMP'` y `createStamp({ id, userId, stand, scannedAt, zoneLevel, multiplier, hasTrivia })`, que deja `trivia_result = 'PENDING'` o `'SKIPPED'`
- [ ] T022 [P] [US1] Implementar `src/modules/gamification/domain/xp/multiplier.ts` con `computeMultiplier({ zoneLevel: OccupancyLevel | null, personalBoost: boolean })` devolviendo de momento siempre 1.0 (US2 y US3 lo amplían; dejar la firma definitiva según research.md R11)
- [ ] T023 [US1] Implementar el caso de uso `src/modules/gamification/application/useCases/handleStandScanned.ts`: en una sola `withTransaction`, aplicar `decideScan`, crear el sello y la transacción `STAMP` (`reference_id = stamp.id`, multiplicador de `computeMultiplier`) y devolver el resultado discriminado de contracts/domain-events.md (`NEW_STAMP` con `trivia` / `ALREADY_VISITED` con `rating` / `UNKNOWN_STAND`); después del commit, publicar `HapticFeedbackRequested{STAMP_SUCCESS}` (depende de T014, T021, T022)
- [ ] T024 [US1] Implementar `src/modules/gamification/application/useCases/answerTrivia.ts`: `answerTrivia({ stampId, selectedIndex | null, elapsedMs })`, que solo transiciona desde `PENDING`, guarda `trivia_result` y `trivia_answered_at` y, si es `CORRECT`, inserta `TRIVIA` con `base_xp = stand_trivia.bonus_xp` y el `applied_multiplier` del sello (`reference_id = stamp.id`); añadir `expireStaleTrivia(now)`, que pasa a `TIMEOUT` los sellos `PENDING` con más de 15 s (para cuando se reabre la app) (depende de T019, T023)
- [ ] T025 [US1] Implementar `src/modules/gamification/application/useCases/submitRating.ts`: valida con `assertCanRate` y `validateStars`, inserta `stand_ratings` y `RATING` de 25 XP (`reference_id = rating.id`, `multiplier = 1`) en una transacción y luego publica `StandRatingSubmitted` (depende de T020, T014)
- [ ] T026 [US1] Suscribir `StandNfcScanned → handleStandScanned` en `registerGamificationModule.ts` y publicar el resultado como evento interno `StampFlowRequested` para la UI; llamar a `expireStaleTrivia` al registrar el módulo (depende de T023, T024)
- [ ] T027 [P] [US1] Crear el simulador de dev en `src/modules/gamification/infrastructure/events/devSimulators.ts`: `simulateStandScan(bus, { userId, standId })` y `simulateWristbandWritten(bus, { userId, eventoId })` con `tagUid`/`wristbandUid` ficticios; solo se usa con `__DEV__`
- [ ] T028 [US1] Implementar el hook `src/modules/gamification/presentation/hooks/useStampFlow.ts`: se suscribe a `StampFlowRequested` y expone `{ step: 'idle' | 'trivia' | 'rating' | 'alreadyVisited' | 'unknown' | 'done', stamp, trivia, xpGained, answer(index | null, elapsedMs), rate(stars), skipRating(), close() }`
- [ ] T029 [P] [US1] Crear `src/modules/gamification/presentation/components/TriviaCountdown.tsx`: cuenta atrás de 15 s con barra y texto accesible (`accessibilityLiveRegion`); llama a `onTimeout` al llegar a 0
- [ ] T030 [US1] Crear `src/modules/gamification/presentation/components/StampFlowModal.tsx`: modal con confirmación de sello (+XP), pregunta con 3 botones y `TriviaCountdown`, feedback de acierto o fallo, selector de 1–5 estrellas con etiquetas accesibles, opción «Valorar más tarde» y la vista «Ya visitado» con la valoración previa; montarlo en `PassportScreen.tsx` (Spec 09) junto a un panel `__DEV__` de simulación con un selector de estand que usa `devSimulators` (depende de T027, T028, T029 y Spec 09)
- [ ] T031 [US1] Implementar `src/modules/gamification/presentation/hooks/usePassport.ts`: sellos del asistente con nombre del estand, total de XP (`sumXp`), estands pendientes de valorar y `rateLater(standId, stars)`; se refresca con los eventos del módulo. Devuelve `PassportViewData` (`src/domain/gamification/passportView.ts`, Spec 09) usando `toPassportViewData` (T080), sustituye al mock en `PassportScreen.tsx` y añade la sección «Pendientes de valorar» (depende de Spec 09)
- [ ] T033 [US1] Migrar `src/database/OrganizerDashboardRepository.ts` para leer `user_stamps` y `stand_ratings` (`AVG(stars)`, `COUNT(stars)`) en lugar de `stamps`/`ratings`, y `seedDevData` en `src/database/initializeDatabase.ts` para insertar en las tablas nuevas; añadir al seed una `stand_trivia` por estand mock (depende de T011)

**Checkpoint**: US1 funciona sola en modo avión (quickstart.md escenarios 2–4).

---

## Phase 4: User Story 2 - Batalla de Facciones y Misiones Relámpago (Priority: P1)

**Goal**: al grabar la pulsera, el asistente entra en una facción (reparto equilibrado); todo su XP cuenta para ella; sello y trivia ×2.0 en zonas `available` (GREEN) según el nivel en el instante del escaneo; aviso de Misión Relámpago con cooldown de 20 min por zona.

**Independent Test**: dos asistentes en facciones distintas; simular `ZoneOccupancyChanged` a `available`; escanear un estand de esa zona → sello 200 XP y trivia 100 XP atribuidos a la facción correcta; repetir el cambio antes de 20 min → sin aviso nuevo (quickstart.md escenarios 1, 5, 6).

### Tests for User Story 2 ⚠️

- [ ] T034 [P] [US2] Tests de dominio en `tests/gamificationFaction.test.mjs`: `assignBalancedFaction` (elige la de menos miembros y desempata por `name`), `computeMultiplier` (`available` → 2.0; `medium`, `full`, `unavailable` y `null` → 1.0) y `shouldNotify` (solo en la transición `≠available → available`; con `lastSentAt` a 19:59 min → false, a 20:00 min exactos → true, sin `lastSentAt` → true)
- [ ] T035 [P] [US2] Test de integración offline en `tests/gamificationFlashMission.test.mjs`: `AttendeeWristbandWritten` dos veces → una sola fila en `attendee_factions`; `ZoneOccupancyChanged(available)` → `zone_occupancy_cache` actualizada y `FlashMissionAlertRequested` publicado; el mismo cambio 10 min después (con `FakeClock`) → sin publicación; escanear un estand de esa zona → `applied_multiplier = 2`, `STAMP final_xp = 200` y `TRIVIA final_xp = 100`; si la zona pasa a `full` antes de responder, la trivia sigue a ×2; todas las transacciones llevan el `faction_id` del asistente

### Implementation for User Story 2

- [ ] T036 [P] [US2] Implementar `src/modules/gamification/domain/faction/assignFaction.ts`: `assignBalancedFaction(factions, memberCounts): Faction` (error si el evento no tiene facciones)
- [ ] T037 [P] [US2] Implementar `src/modules/gamification/domain/flashMission/flashMission.ts`: `FLASH_MISSION_COOLDOWN_MS = 20 * 60_000` y `shouldNotify({ previousLevel, level, lastSentAt, now })`
- [ ] T038 [US2] Completar `computeMultiplier` en `src/modules/gamification/domain/xp/multiplier.ts` con el factor de zona: `ZONE_MULTIPLIER = 2.0` solo si `zoneLevel === 'available'` (research.md R8) (depende de T022)
- [ ] T039 [US2] Añadir a `SqliteGamificationRepository.ts` los métodos `listFactions(eventoId)`, `countMembersByFaction(eventoId)`, `insertAttendeeFaction` (`INSERT OR IGNORE`), `upsertZoneLevel(zoneId, level, updatedAt)`, `getFlashAlert(zoneId)` y `setFlashAlert(zoneId, sentAt)` (depende de T014)
- [ ] T040 [US2] Implementar `src/modules/gamification/application/useCases/assignFaction.ts` (idempotente por `(user_id, evento_id)`) y `handleZoneOccupancyChanged.ts` (actualiza la caché y, si `shouldNotify`, guarda `flash_mission_alerts` y publica `FlashMissionAlertRequested` con `alertId` UUID y `multiplier: 2`) (depende de T036, T037, T039)
- [ ] T041 [US2] Actualizar `handleStandScanned.ts` para leer `getZoneLevel(stand.zone_id)` y `getAttendeeFaction` y propagar el multiplicador y el `faction_id` a la transacción `STAMP`; asegurar que `answerTrivia.ts`, `submitRating.ts` y cualquier creación de XP rellenan `faction_id` (`null` si aún no hay facción) (depende de T038, T040)
- [ ] T042 [US2] Suscribir `AttendeeWristbandWritten → assignFaction` y `ZoneOccupancyChanged → handleZoneOccupancyChanged` en `registerGamificationModule.ts` (depende de T040)
- [ ] T043 [P] [US2] Productor provisional de `ZoneOccupancyChanged` en `src/modules/gamification/infrastructure/events/zoneOccupancyBridge.ts`: `publishZoneLevelChanges(bus, previous: ZoneOccupancy[], next: ZoneOccupancy[])`, que compara `level` por zona y publica solo los cambios. Llamarlo desde `src/hooks/useMapData.ts` cada vez que llega un snapshot nuevo, guardando el anterior en un `useRef` (coordinar con Rafa: es el punto de integración de contracts/domain-events.md)
- [ ] T044 [P] [US2] Consumidor provisional de `FlashMissionAlertRequested` en `src/providers/NotificationProvider.tsx`: suscribirse vía `useGamification().bus` y mostrar una notificación local «⚡ Misión Relámpago: la zona {zoneName} está tranquila, ¡sellos ×2!», guardándola como `CAPACITY_ALERT` con `related_zone_id` (deduplicar por `alertId`; coordinar con Rafa)
- [ ] T045 [US2] Mostrar la facción (nombre y color) y una insignia «×2 activo» por zona en `PassportScreen.tsx`, y en `StampFlowModal.tsx` mostrar el multiplicador aplicado; añadir «Grabar pulsera» al panel de dev (depende de Spec 09 (TASK-10), T030, T041)

**Checkpoint**: US1 y US2 funcionan juntas y por separado.

---

## Phase 5: User Story 3 - Ruleta de Recompensa Variable (Priority: P2)

**Goal**: cada X sellos (X = 3 por defecto) se habilita una tirada; los premios se reparten 40/30/20/10 (configurables); el ×1.5 se aplica al siguiente estand nuevo; los premios físicos quedan pendientes de canje.

**Independent Test**: sellar 3 estands → 1 tirada `PENDING`; girar con `SeededRandom` → premio persistido antes de la animación; si es `MULTIPLIER_1_5`, el siguiente sello vale 150 XP (o 300 en una zona `available`) (quickstart.md escenario 7).

### Tests for User Story 3 ⚠️

- [ ] T046 [P] [US3] Tests de dominio en `tests/gamificationRoulette.test.mjs`: `validateWeights` (enteros ≥ 0 que suman 100; si no, valores por defecto 40/30/20/10), `pickReward` sobre los límites acumulados (r = 0 → `XP_200`, r = 0.3999 → `XP_200`, r = 0.4 → `MULTIPLIER_1_5`, r = 0.9 → `PHYSICAL_PRIZE`), `spinsToCreate(stampCount, X, existingTriggers)` y distribución en 1 000 tiradas con `SeededRandom` dentro de ±5 pp (SC-005); `computeMultiplier` con `personalBoost` → 1.5 y combinado con zona → 3.0
- [ ] T047 [P] [US3] Test de integración offline en `tests/gamificationRouletteFlow.test.mjs`: con el 3.er sello se crea un `roulette_spins` `PENDING` con `trigger_stamp_count = 3`; con 6 sellos sin girar hay 2 pendientes; `spinRoulette` → `SPUN` + `reward_type` y publica `HapticFeedbackRequested{ROULETTE_WIN}`; girar la misma tirada otra vez → error; `XP_200` → `xp_transactions ROULETTE` de 200; `MULTIPLIER_1_5` → el siguiente sello nuevo tiene `applied_multiplier = 1.5` y la tirada pasa a `CONSUMED` en la misma transacción; `claimPhysicalPrize` → `CLAIMED`

### Implementation for User Story 3

- [ ] T048 [P] [US3] Implementar `src/modules/gamification/domain/roulette/roulette.ts`: `DEFAULT_WEIGHTS`, `validateWeights(json: unknown)`, `pickReward(weights, r)` y `spinsToCreate(stampCount, spinEveryN, existingTriggerCounts): number[]` (research.md R10)
- [ ] T049 [US3] Completar `computeMultiplier` con `PERSONAL_MULTIPLIER = 1.5` combinado por producto (research.md R11) (depende de T038)
- [ ] T050 [US3] Añadir a `SqliteGamificationRepository.ts`: `listSpins(userId, eventoId)`, `insertSpin` (`INSERT OR IGNORE`), `updateSpin(id, { status, reward_type, spun_at, resolved_at })` (solo permite avanzar el estado y vuelve a poner `synced = 0`) y `getActivePersonalBoost(userId, eventoId)` (el `MULTIPLIER_1_5` `SPUN` con menor `spun_at`) (depende de T014)
- [ ] T051 [US3] Implementar `src/modules/gamification/application/useCases/spinRoulette.ts` (resuelve con `RandomPort`, persiste `SPUN` y crea la `ROULETTE` de 200 si toca, todo antes de devolver el resultado a la UI; publica `ROULETTE_WIN`) y `claimPhysicalPrize.ts` (solo `PHYSICAL_PRIZE` `SPUN` → `CLAIMED`) (depende de T048, T050)
- [ ] T052 [US3] Actualizar `handleStandScanned.ts`: consultar `getActivePersonalBoost`, pasar `personalBoost` a `computeMultiplier`, marcar la tirada `CONSUMED` en la misma transacción y, tras insertar el sello, crear las tiradas de `spinsToCreate` (con `gamification_config.spin_every_n_stamps`) e incluir `newSpins` en el resultado (depende de T049, T051)
- [ ] T053 [P] [US3] Crear `src/modules/gamification/presentation/components/RouletteWheel.tsx`: ruleta SVG (`react-native-svg`, ya instalado) con 4 sectores proporcionales a los pesos y giro con `Animated.timing` (`useNativeDriver: true`) hasta el sector del premio ya resuelto; texto accesible con el resultado; respeta `AccessibilityInfo.isReduceMotionEnabled` (sin animación)
- [ ] T054 [US3] Implementar `src/modules/gamification/presentation/hooks/useRoulette.ts` (`pendingSpins`, `spin()`, `lastReward`, premios físicos pendientes) e integrarlo en `PassportScreen.tsx`: botón «Girar ruleta (n)» que abre `RouletteWheel` y sección «Mis premios» (boletos, ×1.5 activo, premio físico pendiente de canje). Al reabrir la app, una tirada `SPUN` sin mostrar enseña directamente su resultado (depende de T051, T053)

**Checkpoint**: US1 + US3 funcionan sin US2 (el ×1.5 funciona sin multiplicador de zona).

---

## Phase 6: User Story 4 - Insignias Ocultas (Priority: P2)

**Goal**: evaluación local, tras cada sello o valoración, de `EARLY_BIRD` (+150), `EXPERT_CRITIC` (+200), `SECTOR_EXPLORER` (+300) y `SPEEDRUNNER` (+250); como mucho una vez cada una y ocultas hasta desbloquearlas.

**Independent Test**: en modo avión, 3 sellos en ≤ 5 min → `SPEEDRUNNER` + `ACHIEVEMENT_UNLOCKED`; repetir no da más XP (quickstart.md escenario 8).

### Tests for User Story 4 ⚠️

- [ ] T055 [P] [US4] Tests de dominio en `tests/gamificationAchievements.test.mjs` sobre `evaluateAchievements(snapshot, unlocked, eventStart)` con valores límite: `EARLY_BIRD` con el primer sello a 15:00 min → sí, a 15:01 → no, antes de `fecha_inicio` → no, y no se concede si el primer sello fue tardío aunque haya otros después; `EXPERT_CRITIC` con 4 → no, 5 distintos → sí; `SECTOR_EXPLORER` con una zona de 2 estands sellados → sí, con estands sin `zone_id` → ignorados, con zona de 0 estands → no; `SPEEDRUNNER` con 3 consecutivos en 5:00 → sí, 5:01 → no, ventana deslizante sobre 4 sellos; ya desbloqueadas → no se repiten
- [ ] T056 [P] [US4] Test de integración offline en `tests/gamificationAchievementsFlow.test.mjs`: tras los sellos o la valoración se insertan las filas en `user_achievements` y `ACHIEVEMENT` en `xp_transactions` con `reference_id = achievement.id`, se publica un `ACHIEVEMENT_UNLOCKED` por insignia y, al repetir la condición, no se crean filas nuevas

### Implementation for User Story 4

- [ ] T057 [P] [US4] Implementar `src/modules/gamification/domain/achievements/achievements.ts`: `EARLY_BIRD_WINDOW_MS = 15 * 60_000`, `SPEEDRUNNER_WINDOW_MS = 5 * 60_000`, `EXPERT_CRITIC_THRESHOLD = 5` y `evaluateAchievements({ stamps: { standId, zoneId | null, scannedAt }[], ratedStandIds, standsByZone: Map<zoneId, standId[]> }, unlocked: Set<AchievementCode>, eventStart: Date): AchievementCode[]` (research.md R12)
- [ ] T058 [US4] Añadir a `SqliteGamificationRepository.ts`: `listAchievements(userId, eventoId)`, `insertAchievement` (`INSERT OR IGNORE`) y `getStandsByZone(eventoId)` (depende de T014)
- [ ] T059 [US4] Implementar `src/modules/gamification/application/useCases/unlockAchievements.ts` (construye el snapshot, evalúa e inserta logro + `ACHIEVEMENT` con `ACHIEVEMENT_XP[code]` y `faction_id` en la transacción del llamador; devuelve los códigos nuevos) e invocarlo desde `handleStandScanned.ts` y `submitRating.ts`, publicando `ACHIEVEMENT_UNLOCKED` después del commit e incluyendo `unlockedAchievements` en el resultado (depende de T057, T058, T023, T025)
- [ ] T060 [P] [US4] Crear `src/modules/gamification/presentation/components/AchievementGrid.tsx`: 4 casillas; las bloqueadas muestran «???» sin revelar la condición (FR-016) y las desbloqueadas, nombre en español (Madrugador, Crítico Experto, Explorador de Sector, Velocista), XP y fecha
- [ ] T061 [US4] Integrar `AchievementGrid` en `PassportScreen.tsx` y añadir en `StampFlowModal.tsx` un aviso de «¡Insignia desbloqueada!» cuando el resultado incluya `unlockedAchievements` (depende de T059, T060)

**Checkpoint**: US1–US4 completas offline.

---

## Phase 7: User Story 5 - Ranking Público y Marcador de Facciones (Priority: P3)

**Goal**: ranking de estands por media bayesiana (m = 5) y total de XP por facción, accesibles desde la app y desde el Dashboard (Joselu) vía `IRankingProjectionPort`, con los últimos datos conocidos cuando no hay red.

**Independent Test**: varias valoraciones de prueba; un estand con un único 5 ★ queda por debajo de uno con 20 valoraciones de 4.5 ★; el marcador es igual a la suma de `xp_transactions`; sin red se muestra «Actualizado a las HH:MM» (quickstart.md escenario 10).

### Tests for User Story 5 ⚠️

- [ ] T062 [P] [US5] Tests de dominio en `tests/gamificationRanking.test.mjs`: `bayesianScore(v, R, C, m = 5)` (v = 0 → C), ordenación y desempate (score desc → `ratingCount` desc → nombre asc sin distinguir mayúsculas, posiciones consecutivas) y `sumFactionScores` (atribución con `COALESCE(faction_id, facción actual)` e inclusión de facciones con 0 XP)
- [ ] T063 [P] [US5] Test de contrato en `tests/gamificationRankingProjection.test.mjs` para `SqliteRankingProjection` frente a contracts/ranking-projection-port.md: combina la `ranking_cache` remota con valoraciones y XP locales `synced = 0`, `getLastUpdatedAt` devuelve `null` sin sync previa y nunca accede a la red

### Implementation for User Story 5

- [ ] T064 [P] [US5] Implementar `src/modules/gamification/domain/ranking/ranking.ts`: `BAYESIAN_M = 5`, `bayesianScore`, `rankStands(entries)` y `sumFactionScores(transactions, attendeeFactions, factions)`
- [ ] T065 [US5] Implementar `src/modules/gamification/infrastructure/sqlite/SqliteRankingProjection.ts` (implementa `IRankingProjectionPort`): lee `ranking_cache`/`faction_score_cache`, aplica el delta local pendiente y recalcula con `rankStands`/`sumFactionScores`; la hora sale de `local_sync_state` (scope `gamification_ranking:<eventoId>`). Exportarlo junto con el tipo del puerto desde `src/modules/gamification/index.ts`, la única superficie pública del módulo (depende de T064)
- [ ] T066 [US5] Añadir a `supabase/migrations/0002_gamification.sql` (y `schema.sql`) las views `stand_ranking` (bayesiana con `m = 5` y `C` = media del evento) y `faction_scores` (`SUM(final_xp)` con `COALESCE(xp.faction_id, af.faction_id)` y `member_count`), ambas `WITH (security_invoker = true)` (depende de T013)
- [ ] T067 [US5] Implementar `src/modules/gamification/presentation/hooks/useRanking.ts` y `presentation/screens/RankingScreen.tsx` (dos pestañas internas, «Estands» con posición, nombre, ★ media, nº de valoraciones y puntuación, y «Facciones» con barras del color de cada facción; pie «Actualizado a las HH:MM» o «Sin sincronizar»), y la ruta `src/app/ranking.tsx` + `<Tabs.Screen name="ranking" …>` en `src/app/_layout.tsx` (depende de T065)
- [ ] T068 [US5] Exponer `IRankingProjectionPort` al Dashboard: añadir `getRankingProjection()` a `useGamification()` en `GamificationProvider.tsx` y documentar en `contracts/ranking-projection-port.md` cómo lo consume `OrganizerDashboardScreen` (Joselu integra la vista) (depende de T065)

**Checkpoint**: las 5 historias funcionan offline; falta la sincronización remota.

---

## Phase 8: Sincronización idempotente (transversal, FR-020 – FR-022)

**Purpose**: subir lo pendiente y bajar las proyecciones según contracts/supabase-sync.md. Afecta a todas las historias, pero no las bloquea: todas funcionan offline sin esta fase.

- [ ] T069 [P] Test de sync en `tests/gamificationSync.test.mjs` con `InMemoryRemote`: el orden de subida es `attendee_factions → user_stamps → stand_ratings → user_achievements → roulette_spins → xp_transactions`; no se envía `synced`; un fallo a mitad deja las filas no confirmadas con `synced = 0`; al reintentar no hay duplicados en el remoto y `Σ final_xp` no cambia (SC-003, SC-004); un sello subido con `PENDING` y resuelto después solo actualiza `trivia_result`/`trivia_answered_at`; dos `syncGamification` simultáneos ejecutan una sola subida y repiten al terminar; la bajada reemplaza `ranking_cache`/`faction_score_cache` en una transacción y actualiza `local_sync_state`
- [ ] T070 Implementar `src/modules/gamification/infrastructure/supabase/SupabaseGamificationRemote.ts` (implementa `GamificationRemotePort`): `upsert(rows, { onConflict, ignoreDuplicates: true })` por tabla con las claves de contracts/supabase-sync.md, lotes de 500, `update` condicionado para la trivia (`.eq('id', …).eq('trivia_result', 'PENDING')`) y para el estado de las tiradas, y `select` de `factions`, `stand_trivia`, `gamification_config`, `stand_ranking` y `faction_scores` filtrados por `evento_id`; usa `supabase` y `ensureSession` de `src/lib/supabase.ts`
- [ ] T071 Implementar `src/modules/gamification/application/useCases/syncGamification.ts` con serialización (una ejecución a la vez y repetición si se pidió otra, como `src/sync/eventosSync.ts`), subida en orden con `markSynced` por lote confirmado y bajada en transacción; añadir a `SqliteGamificationRepository.ts` `replaceRankingCache`, `replaceFactionScoreCache`, `replaceFactions`, `replaceTrivia` y `replaceConfig` (depende de T069, T070)
- [ ] T072 Lanzar `syncGamification` desde `GamificationProvider.tsx` al montar y al pasar de offline a online con `useNetworkState` de `expo-network` (mismo patrón que `src/providers/SyncProvider.tsx`) y también tras cada escritura local si hay red; los errores se registran con `console.warn` y nunca bloquean la UI (depende de T071)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T073 [P] Test de rendimiento en `tests/gamificationPerformance.test.mjs`: con 100 estands y 50 sellos previos, `handleStandScanned` hasta la publicación de `STAMP_SUCCESS` tarda < 200 ms de mediana en 20 ejecuciones sobre `node:sqlite` (SC-002)
- [ ] T074 [P] Test de arquitectura en `tests/gamificationArchitecture.test.mjs`: recorre `src/modules/gamification/domain/**` y `application/**` y falla si algún fichero importa `react-native`, `expo`, `@supabase` o rutas de `infrastructure/` o `presentation/`
- [ ] T075 [P] Revisar la accesibilidad de `StampFlowModal`, `RouletteWheel`, `AchievementGrid` y `RankingScreen`: `accessibilityLabel`/`accessibilityRole` en todos los controles, el color nunca como único indicador (facciones, estado ×2) y tamaños táctiles ≥ 44 pt
- [ ] T076 [P] Actualizar la documentación: `README.md` (sección de Gamificación), `CLAUDE.md` (quitar «en diseño» de `src/modules/gamification/`, añadir el bus en Arquitectura y la nota de que `Stand.zone_id` es nuevo) y `specs/004-gamification-passport/quickstart.md` si algún paso cambió
- [ ] T077 Ejecutar desde `app-eventos/` `npm run lint`, `npx tsc --noEmit` y `npm run test:domain` y corregir todos los errores
- [ ] T078 Validar a mano los 10 escenarios de `specs/004-gamification-passport/quickstart.md` y las consultas SQL de comprobación en Supabase (sin duplicados en `xp_transactions`)

---

## Dependencies & Execution Order

### Dependencias entre fases

```text
Phase 1 Setup ──▶ Phase 2 Foundational ──┬─▶ Phase 3 US1 (MVP) ──┬─▶ Phase 4 US2
                                         │                       ├─▶ Phase 5 US3
                                         │                       ├─▶ Phase 6 US4
                                         │                       └─▶ Phase 7 US5
                                         └─▶ Phase 8 Sync (cuando existan las tablas; T071 necesita los repos de US1–US4)
                                                                     ▼
                                                             Phase 9 Polish
```

- **US1** solo depende de la fundación. El resto de historias usan el flujo de sellado de US1 (`handleStandScanned`), así que empiezan después de T023–T025.
- **US2, US3 y US4** son independientes entre sí: cada una amplía `handleStandScanned.ts` en un punto distinto (multiplicador de zona y facción / boost personal y tiradas / insignias). Si se hacen en paralelo, hay que fusionar con cuidado los cambios en ese fichero y en `computeMultiplier` (T038 → T049 en ese orden).
- **US5** solo necesita que existan valoraciones y transacciones (US1); el marcador de facciones tiene sentido con US2, pero funciona con facciones vacías.
- **Sync** se puede desarrollar en paralelo a US2–US5 contra `InMemoryRemote`; T072 se conecta al final.

### Dentro de cada historia

Tests (deben fallar) → dominio puro [P] → repositorio → caso de uso → registro en el bus → hooks → componentes → pantalla.

### Parallel Opportunities

- Setup: T002 ∥ T003.
- Foundational: T004 ∥ T005 ∥ T006 ∥ T007 ∥ T008 ∥ T009 ∥ T012 ∥ T015.
- Cada historia: sus dos tests [P] en paralelo y luego todos sus ficheros de dominio [P] en paralelo.
- Tras US1: tres personas pueden repartirse US2, US3 y US4, y una cuarta US5 + Sync.

## Parallel Example: User Story 1

```text
# Tests primero (en paralelo):
T017 tests/gamificationStamp.test.mjs
T018 tests/gamificationStampFlow.test.mjs

# Dominio puro (en paralelo):
T019 domain/trivia/trivia.ts
T020 domain/rating/rating.ts
T021 domain/stamp/stamp.ts
T022 domain/xp/multiplier.ts

# Después, en secuencia: T023 → T024 → T025 → T026
# UI en paralelo con los casos de uso: T027, T029
```

## Parallel Example: User Story 3

```text
T046 tests/gamificationRoulette.test.mjs   ∥  T047 tests/gamificationRouletteFlow.test.mjs
T048 domain/roulette/roulette.ts           ∥  T053 presentation/components/RouletteWheel.tsx
```

## Implementation Strategy

### MVP primero (solo US1)

1. Fases 1 y 2.
2. Fase 3 (US1).
3. **Parar y validar**: quickstart.md escenarios 2–4 en modo avión y `npm run test:domain` en verde.
4. Demo: pasaporte con sellos, trivia y valoración offline.

### Entrega incremental

1. Fundación + US1 → MVP.
2. + US2 (facciones y ×2): el bloque P1 completo.
3. + US3 (ruleta) y US4 (insignias), en el orden que prefiera el equipo.
4. + US5 (ranking) + Fase 8 (sync) → datos centrales y dashboard.
5. Fase 9 → PR a `main`.

Cada incremento se cierra con lint + typecheck + tests (CLAUDE.md) y un commit `implementar … [US-04.N]`.

## Notes

- Puntos de coordinación con otros integrantes: T012 y T043 (Rafa, modelo de mapa y productor de aforo), T044 (Rafa, notificaciones), T068 (Joselu, dashboard), y los consumidores de `HapticFeedbackRequested` (Javi) y los productores NFC reales (Hugo) sustituyen a los simuladores de T027 sin tocar el módulo.
- `stamps` y `ratings` antiguas se conservan sin uso tras T033; borrarlas sería una migración futura aparte.
- Ninguna tarea añade dependencias npm.
