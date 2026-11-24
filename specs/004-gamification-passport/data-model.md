# Data Model: Motor de Gamificación, Pasaporte Digital y Valoración

Fase 1 de [plan.md](plan.md). Tipos en formato *SQLite local / PostgreSQL remoto*. Todas las claves primarias son UUID generados en el cliente salvo que se indique otra cosa. Las columnas `synced` solo existen en local (`INTEGER 0|1`, por defecto `0`) y nunca se suben.

## Diagrama

```text
eventos 1───* factions 1───* attendee_factions *───1 users
eventos 1───1 gamification_config
zones   1───* stands (zone_id, nuevo)
stands  1───0..1 stand_trivia
users ─┬─* user_stamps     *───1 stands     UNIQUE(user_id, stand_id)
       ├─* stand_ratings   *───1 stands     UNIQUE(user_id, stand_id)
       ├─* user_achievements                UNIQUE(user_id, evento_id, code)
       ├─* roulette_spins                   UNIQUE(user_id, evento_id, trigger_stamp_count)
       └─* xp_transactions *───0..1 factions UNIQUE(source_type, reference_id)
```

## Entidades

### Faction — `factions`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | TEXT / UUID | PK |
| evento_id | TEXT / UUID | FK `eventos(id)`, NOT NULL |
| name | TEXT / VARCHAR(60) | NOT NULL, UNIQUE(evento_id, name) |
| color_hex | TEXT / CHAR(7) | `^#[0-9A-Fa-f]{6}$` |

Solo se descarga (la crea la organización).

### AttendeeFaction — `attendee_factions`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| evento_id | UUID | NOT NULL |
| faction_id | UUID | FK `factions(id)`, NOT NULL |
| assigned_at | TEXT ISO / TIMESTAMPTZ | NOT NULL |
| synced | INTEGER | solo local |

`UNIQUE(user_id, evento_id)`. Se crea en `AttendeeWristbandWritten`. Reparto equilibrado: la facción con menos miembros según los datos locales conocidos; en caso de empate, por `name`. Inmutable.

### StandTrivia — `stand_trivia`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| stand_id | UUID | FK `stands(id)`, UNIQUE |
| question | TEXT | NOT NULL, ≤ 200 caracteres |
| options_json | TEXT / JSONB | array de exactamente 3 strings no vacíos |
| correct_option_index | INTEGER | 0..2 |
| bonus_xp | INTEGER | > 0, por defecto 50 |

Solo se descarga. Si un estand no tiene trivia, `trivia_result = 'SKIPPED'`.

### PassportStamp — `user_stamps`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| stand_id | UUID | FK `stands(id)`, NOT NULL |
| evento_id | UUID | NOT NULL (el del estand) |
| scanned_at | TEXT ISO / TIMESTAMPTZ | NOT NULL |
| zone_level_at_scan | TEXT | `available` \| `medium` \| `full` \| `unavailable` \| NULL (estand sin zona) |
| applied_multiplier | REAL / NUMERIC(4,2) | zona × personal ∈ {1.0, 1.5, 2.0, 3.0} |
| trivia_result | TEXT | `PENDING` \| `CORRECT` \| `WRONG` \| `TIMEOUT` \| `SKIPPED` |
| trivia_answered_at | TEXT / TIMESTAMPTZ | NULL hasta que se responde |
| synced | INTEGER | solo local |

`UNIQUE(user_id, stand_id)` (FR-001).

**Transición de `trivia_result`** (una sola vez):
```text
PENDING ──acierto ≤15 s──▶ CORRECT
PENDING ──fallo──────────▶ WRONG
PENDING ──>15 s / app cerrada al reabrir──▶ TIMEOUT
(sin trivia) ─────────────▶ SKIPPED
```
Es la única columna mutable junto con `synced`. Si el sello ya se subió con `PENDING`, la resolución se vuelve a subir con un `upsert` que solo actualiza filas `WHERE trivia_result = 'PENDING'` (ver [contracts/supabase-sync.md](contracts/supabase-sync.md)).

### StandRating — `stand_ratings`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| stand_id | UUID | FK `stands(id)`, NOT NULL |
| stars | INTEGER | CHECK 1..5 |
| created_at | TEXT / TIMESTAMPTZ | NOT NULL |
| synced | INTEGER | solo local |

`UNIQUE(user_id, stand_id)`. Inmutable. Solo se puede valorar con un sello previo del mismo estand.

### XpTransaction — `xp_transactions` (append-only)
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| faction_id | UUID | NULL si aún no tiene facción |
| evento_id | UUID | NOT NULL |
| source_type | TEXT | `STAMP` \| `TRIVIA` \| `RATING` \| `ACHIEVEMENT` \| `ROULETTE` |
| reference_id | UUID | id del sello (STAMP, TRIVIA), valoración, logro o tirada |
| base_xp | INTEGER | > 0 |
| multiplier | REAL / NUMERIC(4,2) | ≥ 1; = 1 para RATING, ACHIEVEMENT y ROULETTE |
| final_xp | INTEGER | `round(base_xp × multiplier)` |
| created_at | TEXT / TIMESTAMPTZ | NOT NULL |
| synced | INTEGER | solo local |

`UNIQUE(source_type, reference_id)`. Local: triggers `BEFORE DELETE` → `RAISE(ABORT)` y `BEFORE UPDATE` → `RAISE(ABORT)` salvo cambio exclusivo de `synced`. Remoto: sin policies de UPDATE/DELETE.

**Facción nula**: si el asistente recibe facción más tarde, sus transacciones anteriores se atribuyen a ella en las views mediante `COALESCE(xp.faction_id, af.faction_id)` (join con `attendee_factions`). No se reescribe ninguna fila.

**Tabla de XP base**:
| Origen | base_xp | Multiplicable |
|--------|---------|---------------|
| STAMP | 100 | sí |
| TRIVIA (acierto) | 50 (`stand_trivia.bonus_xp`) | sí (multiplicador del sello) |
| RATING | 25 | no |
| ACHIEVEMENT | 150 / 200 / 300 / 250 | no |
| ROULETTE (`XP_200`) | 200 | no |

### UserAchievement — `user_achievements`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| evento_id | UUID | NOT NULL |
| code | TEXT | `EARLY_BIRD` \| `EXPERT_CRITIC` \| `SECTOR_EXPLORER` \| `SPEEDRUNNER` |
| unlocked_at | TEXT / TIMESTAMPTZ | NOT NULL |
| synced | INTEGER | solo local |

`UNIQUE(user_id, evento_id, code)`. Inmutable. Las reglas están en [research.md R12](research.md).

### RouletteSpin — `roulette_spins`
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| evento_id | UUID | NOT NULL |
| trigger_stamp_count | INTEGER | múltiplo de X (3, 6, 9…) |
| status | TEXT | `PENDING` \| `SPUN` \| `CONSUMED` \| `CLAIMED` |
| reward_type | TEXT | NULL en `PENDING`; `XP_200` \| `MULTIPLIER_1_5` \| `RAFFLE_TICKET` \| `PHYSICAL_PRIZE` |
| spun_at | TEXT / TIMESTAMPTZ | NULL en `PENDING` |
| resolved_at | TEXT / TIMESTAMPTZ | momento de CONSUMED / CLAIMED |
| synced | INTEGER | solo local |

`UNIQUE(user_id, evento_id, trigger_stamp_count)`.

**Transiciones**:
```text
PENDING ──girar──▶ SPUN ─┬─ XP_200 ─────────▶ (crea xp_transaction ROULETTE; queda SPUN)
                         ├─ RAFFLE_TICKET ──▶ (queda SPUN = boleto válido)
                         ├─ MULTIPLIER_1_5 ─▶ CONSUMED al aplicarse en el siguiente sello nuevo
                         └─ PHYSICAL_PRIZE ─▶ CLAIMED cuando el personal lo canjea
```
Como mucho hay un `MULTIPLIER_1_5` en `SPUN` activo a la vez; los siguientes esperan su turno en orden de `spun_at`.

### GamificationConfig — `gamification_config`
| Campo | Tipo | Reglas |
|-------|------|--------|
| evento_id | UUID | PK |
| spin_every_n_stamps | INTEGER | ≥ 1, por defecto 3 |
| roulette_weights_json | TEXT / JSONB | `{XP_200, MULTIPLIER_1_5, RAFFLE_TICKET, PHYSICAL_PRIZE}` enteros que suman 100; por defecto 40/30/20/10 |

Solo se descarga; si no hay fila, se usan los valores por defecto.

### Tablas solo locales
| Tabla | Propósito |
|-------|-----------|
| `zone_occupancy_cache(zone_id PK, level, updated_at)` | último nivel recibido en `ZoneOccupancyChanged` ([R8](research.md)) |
| `flash_mission_alerts(zone_id PK, last_sent_at)` | cooldown de 20 min ([R9](research.md)) |
| `ranking_cache(evento_id, stand_id, score, rating_count, average, PK(evento_id, stand_id))` + `faction_score_cache(evento_id, faction_id, total_xp)` | última proyección bajada; `local_sync_state` (scope `gamification_ranking`) guarda la hora |

### Cambio en una entidad existente
- `stands.zone_id` (TEXT/UUID, FK `zones(id)` `ON DELETE SET NULL`, nullable) en local y en remoto. También se añade a `Stand` en `src/domain/map/mapTypes.ts` como `zone_id: UUID | null` (coordinar con Rafa).

## Migraciones

**Local — entrada nº 4 en `MIGRATIONS` (`src/database/initializeDatabase.ts`)**, dentro de la transacción que ya aplica `runMigrations`:
1. `ALTER TABLE stands ADD COLUMN zone_id …`.
2. `CREATE TABLE` de todas las tablas anteriores, sus índices (`user_id`, `stand_id`, `synced`) y los triggers append-only.
3. `INSERT INTO user_stamps (…) SELECT id, user_id, stand_id, <evento del estand>, scanned_at, NULL, 1.0, 'SKIPPED', NULL, 1 FROM stamps WHERE user_id IS NOT NULL AND stand_id IS NOT NULL`, e igual `ratings → stand_ratings` con `stars = score`. No se genera XP retroactivo.
4. Las tablas `stamps` y `ratings` se conservan por compatibilidad (las migraciones publicadas no se editan). `OrganizerDashboardRepository` y `seedDevData` pasan a usar las tablas nuevas.

**Remota — `supabase/migrations/0002_gamification.sql`**: `stands.zone_id`, las mismas tablas (sin `synced`) con FKs, `CHECK` y `UNIQUE`; copia de `stamps`/`ratings` con `ON CONFLICT DO NOTHING`; RLS `authenticated` de SELECT e INSERT en todas, y UPDATE solo en `user_stamps` (resolver la trivia) y `roulette_spins` (cambios de estado); views `faction_scores` y `stand_ranking` (fórmula en [contracts/ranking-projection-port.md](contracts/ranking-projection-port.md)). `schema.sql` se actualiza para reflejarlo.
