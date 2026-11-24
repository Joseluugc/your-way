# Implementation Plan: Motor de Gamificación, Pasaporte Digital y Valoración

**Branch**: `004-gamification-passport` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-gamification-passport/spec.md`

## Summary

Motor de gamificación offline-first para asistentes: sellado de estands por NFC con Micro-Trivia y valoración, facciones con multiplicador ×2 en zonas de baja ocupación, ruleta de recompensa variable, insignias ocultas, ranking bayesiano de estands y marcador de facciones.

Enfoque técnico: un módulo hexagonal autocontenido en `app-eventos/src/modules/gamification/` (`domain` → `application` → `infrastructure` / `presentation`). Toda escritura va primero a SQLite local, y los puntos se registran en un **libro mayor append-only** (`xp_transactions`). El módulo se integra con los demás solo por **eventos de dominio** en un bus tipado en proceso y por el puerto de consulta `IRankingProjectionPort`. La sincronización con Supabase es idempotente: UUID generado en cliente, claves únicas naturales y `upsert` con `ignoreDuplicates` (`ON CONFLICT DO NOTHING`).

## Technical Context

**Language/Version**: TypeScript 6 (`strict`, sin `any`) · Expo SDK 58 · React Native 0.88 · React 19.3

**Primary Dependencies**: `expo-sqlite` (persistencia local), `expo-network` (detección de reconexión, ya usado en `SyncProvider`), `@supabase/supabase-js`, `expo-notifications` (aviso de Misión Relámpago, lo consume el módulo de Notificaciones), `Animated` de React Native (ruleta). **Ninguna dependencia nueva.** Los hápticos los ejecuta el módulo de Accesibilidad (Javi) a partir de `HapticFeedbackRequested`.

**Storage**: SQLite local `your-way-v2.db` (migración versionada nº 4 en `initializeDatabase.ts`) · PostgreSQL en Supabase (`supabase/migrations/0002_gamification.sql`, views `faction_scores` y `stand_ranking`).

**Testing**: `node:test` + `node:sqlite` con `--experimental-strip-types` (`npm run test:domain`): pruebas unitarias del dominio y pruebas de integración offline de los casos de uso sobre SQLite real (mismo arnés que `tests/mapOfflineSync.test.mjs`) y un `GamificationRemotePort` falso.

**Target Platform**: Android / iOS. Para la lectura NFC real hace falta un development build (`react-native-nfc-manager`, módulo de Hugo). En Expo Go y en los tests se usan simuladores de eventos.

**Project Type**: mobile-app (offline-first) + BaaS (Supabase)

**Performance Goals**: < 200 ms desde `StandNfcScanned` hasta el sello persistido y `HapticFeedbackRequested` publicado (SC-002); flujo completo sello → trivia → valoración en < 20 s (SC-001); ruleta animada a 60 fps.

**Constraints**: todas las operaciones de US1–US4 funcionan sin red; ningún contador mutable de XP; la sincronización tolera reintentos sin duplicar; el dominio no puede importar React Native ni Expo.

**Scale/Scope**: un evento con ~10–100 estands, ~5–20 zonas, 2–4 facciones y hasta unos miles de asistentes; por asistente, decenas de sellos y cientos de transacciones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Referencia: [`constitution.md`](../../constitution.md).

| Principio | Estado | Cómo se cumple |
|-----------|--------|----------------|
| Hexagonal / DDD; lógica de gamificación agnóstica a RN (§3) | ✅ | `domain/` y `application/` en TS puro; RN/Expo/Supabase solo en `infrastructure/` y `presentation/`. |
| TypeScript estricto, sin `any` (§3) | ✅ | Payloads de eventos y filas tipados; parseo defensivo de JSON (`options_json`, `roulette_weights_json`). |
| Funcional offline antes que en la nube (§4) | ✅ | Los casos de uso escriben en SQLite; la sync es un adaptador aparte que se puede desactivar. |
| UI separada de la persistencia (§4) | ✅ | Pantallas → hooks/presenters → casos de uso; las pantallas no tocan SQL. |
| Almacenamiento: SQLite (WatermelonDB/PowerSync recomendado) (§1) | ⚠️ | Se usa `expo-sqlite`, ya estándar en el repo. Ver Complexity Tracking. |
| Backend Node.js + PostgreSQL "futuro" (§1) | ⚠️ | PostgreSQL vía Supabase, sin API Node intermedia. Ver Complexity Tracking. |
| Ramas `feature/TASK-XX-…` (§3) | ⚠️ | La rama se llama `004-gamification-passport` por convención de Spec Kit; se puede renombrar antes del PR. |
| Lectura NFC con `react-native-nfc-manager` (§1) | ✅ | Este módulo no lee NFC; consume `StandNfcScanned` del módulo de Hugo. |

**Resultado del gate**: PASA con desviaciones justificadas.

**Re-check tras la fase 1**: PASA. El diseño ([data-model.md](data-model.md), [contracts/](contracts/)) no añade dependencias ni acoplamientos directos con otros módulos, y el dominio sigue libre de imports de plataforma.

## Project Structure

### Documentation (this feature)

```text
specs/004-gamification-passport/
├── spec.md
├── plan.md              # Este fichero
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   ├── domain-events.md
│   ├── ranking-projection-port.md
│   └── supabase-sync.md
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
app-eventos/src/
├── modules/gamification/
│   ├── domain/                      # TS puro, sin RN/Expo
│   │   ├── xp/                      # XpTransaction, XpSource, computeMultiplier (zona ×2.0, personal ×1.5, combinados)
│   │   ├── stamp/                   # PassportStamp, reglas de primer sellado / reescaneo
│   │   ├── trivia/                  # StandTrivia, evaluateAnswer (15 s, 3 opciones)
│   │   ├── rating/                  # StandRating (1..5), validación
│   │   ├── achievements/            # evaluateAchievements: EARLY_BIRD, EXPERT_CRITIC, SECTOR_EXPLORER, SPEEDRUNNER
│   │   ├── roulette/                # RouletteConfig, pickReward(random), spinsUnlocked(stampCount, X)
│   │   ├── ranking/                 # bayesianScore(v, R, C, m=5), sumFactionScores
│   │   ├── faction/                 # assignBalancedFaction
│   │   ├── flashMission/            # shouldNotify(zone, lastSentAt, now, cooldown=20 min)
│   │   └── events.ts                # tipos de eventos de entrada/salida (contracts/domain-events.md)
│   ├── application/
│   │   ├── ports/                   # GamificationRepositoryPort, GamificationRemotePort, EventBusPort,
│   │   │                            # ClockPort, RandomPort, IdGeneratorPort, IRankingProjectionPort
│   │   ├── useCases/                # handleStandScanned, answerTrivia, submitRating, spinRoulette,
│   │   │                            # claimPhysicalPrize, assignFaction, handleZoneOccupancyChanged,
│   │   │                            # syncGamification
│   │   └── registerGamificationModule.ts   # suscribe los handlers al bus
│   ├── infrastructure/
│   │   ├── sqlite/                  # SqliteGamificationRepository, SqliteRankingProjection
│   │   ├── supabase/                # SupabaseGamificationRemote
│   │   └── events/                  # simuladores de dev (StandNfcScanned, AttendeeWristbandWritten)
│   └── presentation/
│       ├── hooks/                   # usePassport, useStampFlow, useRoulette, useRanking
│       ├── screens/                 # PassportScreen, RankingScreen
│       └── components/              # StampFlowModal (trivia + estrellas), TriviaCountdown, RouletteWheel, AchievementGrid
├── shared/events/eventBus.ts        # bus de eventos tipado en proceso (pub/sub), compartido entre módulos
├── providers/GamificationProvider.tsx   # crea los adaptadores, registra el módulo y lanza la sync al reconectar
├── app/pasaporte.tsx, app/ranking.tsx   # rutas: solo reexportan pantallas
└── database/initializeDatabase.ts   # + migración nº 4 (tablas de gamificación, stands.zone_id, copia de stamps/ratings)
    database/OrganizerDashboardRepository.ts   # lee user_stamps / stand_ratings

app-eventos/tests/
├── gamificationDomain.test.mjs      # multiplicadores, trivia, insignias, ruleta, bayesiana, cooldown
├── gamificationOffline.test.mjs     # casos de uso sobre SQLite real sin red
└── gamificationSync.test.mjs        # idempotencia con remoto falso y reintentos

supabase/migrations/0002_gamification.sql   # tablas, UNIQUE, RLS, views; schema.sql se actualiza
```

**Structure Decision**: la gamificación va en `src/modules/gamification/` con las cuatro capas, como se pidió. El resto de la app mantiene su estructura actual (`domain/`, `database/`, `sync/`). Reglas de dependencia: `presentation → application → domain`; `infrastructure` implementa los puertos de `application`; `domain` no importa nada fuera de sí mismo. Ningún otro módulo importa código de `modules/gamification/` salvo `IRankingProjectionPort` y los tipos de `domain/events.ts`.

## Integración entre módulos

| Dirección | Evento / Puerto | Contraparte | Efecto en gamificación |
|-----------|-----------------|-------------|------------------------|
| Entrada | `AttendeeWristbandWritten` | NFC Puerta (Hugo) | `assignFaction` (equilibrada, idempotente por usuario y evento) |
| Entrada | `StandNfcScanned` | Lectura NFC (Hugo) | `handleStandScanned` → sello + XP + insignias + ruleta |
| Entrada | `ZoneOccupancyChanged` | Mapa/Aforo (Rafa) | actualiza la caché de nivel por zona; si pasa a `available` → `FlashMissionAlertRequested` (cooldown de 20 min) |
| Salida | `FlashMissionAlertRequested` | Notificaciones (Rafa) | lo muestra como notificación local |
| Salida | `HapticFeedbackRequested` | Accesibilidad (Javi) | `STAMP_SUCCESS` / `ACHIEVEMENT_UNLOCKED` / `ROULETTE_WIN` |
| Salida | `StandRatingSubmitted` | Dashboard (Joselu) | refresco del dashboard de organización |
| Consulta | `IRankingProjectionPort` | Dashboard (Joselu) | ranking bayesiano + marcador de facciones |

Detalle en [contracts/domain-events.md](contracts/domain-events.md) y [contracts/ranking-projection-port.md](contracts/ranking-projection-port.md).

## Trazabilidad de requisitos

| Requisito | Dónde se implementa |
|-----------|---------------------|
| FR-001, FR-005 | `handleStandScanned` + `UNIQUE(user_id, stand_id)` en `user_stamps` |
| FR-002, FR-003 | `domain/trivia`, `answerTrivia`, `user_stamps.trivia_result` (una sola transición) |
| FR-004 | `submitRating` + `UNIQUE(user_id, stand_id)` en `stand_ratings`; XP con `multiplier = 1` |
| FR-006 | `usePassport` / `PassportScreen` |
| FR-007, FR-008 | `assignFaction`, `attendee_factions`; `xp_transactions.faction_id` + view `faction_scores` |
| FR-009 | `computeMultiplier` + `user_stamps.zone_level_at_scan` / `applied_multiplier` |
| FR-010 | `handleZoneOccupancyChanged` + `domain/flashMission` + `flash_mission_alerts` |
| FR-011 – FR-014 | `domain/roulette`, `spinRoulette`, `claimPhysicalPrize`, `roulette_spins`, `gamification_config` |
| FR-015, FR-016 | `domain/achievements` + `UNIQUE(user_id, evento_id, code)` |
| FR-017 – FR-019 | `domain/ranking`, `IRankingProjectionPort`, views `stand_ranking` / `faction_scores`, caché local con `last_updated_at` |
| FR-020 – FR-022 | SQLite primero, `synced = 0`, `syncGamification` serializado, `upsert ignoreDuplicates` |
| FR-023 | `HapticFeedbackRequested` publicado desde los casos de uso |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `expo-sqlite` en lugar de WatermelonDB (constitución §1 lo recomienda; la petición lo nombraba) | Es la base local que ya usan mapa, eventos y notificaciones; la migración nº 4 convive con las existentes. Decisión del usuario. | WatermelonDB obliga a un development build y a un segundo motor con otro modelo de sync, y duplica la base local. |
| `expo-network` en lugar de NetInfo | Ya es la fuente de conectividad de `SyncProvider`. | NetInfo añade una dependencia con la misma función. |
| Supabase directo en lugar de un API Node.js | El repo no tiene backend Node; la idempotencia (`ON CONFLICT DO NOTHING`) y los agregados (views) se resuelven en Postgres. | Un API Node añade despliegue y hosting sin aportar nada a los requisitos actuales. |
| `node:test` en lugar de Jest/Vitest | Es el runner actual (`npm run test:domain`) y ya ejecuta TS con `node:sqlite` para pruebas de integración offline. | Jest/Vitest supondría una segunda configuración de tests y más dependencias de desarrollo. |
| Carpeta `src/modules/` nueva junto a `src/domain/` | Petición explícita: módulo con capas propias y sin acoplamiento. | Repartir el código en `src/domain`, `src/database` y `src/sync` mezclaría el módulo con los de otros integrantes. |
| Nombre de rama `004-…` | Convención de Spec Kit pedida por el usuario. | Se puede renombrar a `feature/TASK-XX-gamification` antes del PR. |
