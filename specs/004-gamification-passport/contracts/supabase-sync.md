# Contrato: Sincronización de Gamificación con Supabase

Lo implementa `infrastructure/supabase/SupabaseGamificationRemote.ts` (implementa `GamificationRemotePort`) y lo orquesta el caso de uso `syncGamification`.

## Disparo y serialización

- Se lanza al montar `GamificationProvider` y al pasar de offline a online (`useNetworkState` de `expo-network`), igual que `SyncProvider`.
- Una sola ejecución a la vez; si se pide otra mientras corre, se repite al terminar (mismo patrón que `syncEventos` en `src/sync/eventosSync.ts`).
- Antes de nada llama a `ensureSession()` (`src/lib/supabase.ts`).
- Si falla, las filas siguen con `synced = 0` y se reintentan en la siguiente ejecución. El error nunca bloquea la UI.

## Subida (filas con `synced = 0`, lotes de hasta 500)

El orden respeta las FKs:

| # | Tabla | `onConflict` | Modo | Notas |
|---|-------|--------------|------|-------|
| 1 | `attendee_factions` | `user_id,evento_id` | `ignoreDuplicates: true` | |
| 2 | `user_stamps` | `user_id,stand_id` | `ignoreDuplicates: true` | inserción del sello |
| 2b | `user_stamps` (trivia resuelta tras subir) | `id` | `update … where trivia_result = 'PENDING'` | solo `trivia_result`, `trivia_answered_at` |
| 3 | `stand_ratings` | `user_id,stand_id` | `ignoreDuplicates: true` | |
| 4 | `user_achievements` | `user_id,evento_id,code` | `ignoreDuplicates: true` | |
| 5 | `roulette_spins` | `user_id,evento_id,trigger_stamp_count` | insert `ignoreDuplicates` + update de estado | el estado solo avanza (`PENDING < SPUN < CONSUMED/CLAIMED`) |
| 6 | `xp_transactions` | `source_type,reference_id` | `ignoreDuplicates: true` | siempre al final |

- `upsert(rows, { onConflict, ignoreDuplicates: true })` ≡ `INSERT … ON CONFLICT (…) DO NOTHING`.
- No se envían `synced` ni ninguna columna local. Las fechas de los hechos (`scanned_at`, `created_at`, …) las fija el cliente porque son el instante real del hecho; no hacen de cursor.
- Tras cada lote confirmado, `UPDATE … SET synced = 1 WHERE id IN (…)` en local. Es la única actualización que permiten los triggers append-only.
- **Conflicto por clave natural con otro `id`** (p. ej. el mismo sello creado dos veces en reinstalaciones): el remoto conserva la primera fila, el local marca la suya `synced = 1` y la siguiente bajada corrige las proyecciones. No se duplican puntos porque `xp_transactions` referencia el `reference_id` que ya existe.

## Bajada

| Recurso | Filtro | Destino local | Estrategia |
|---------|--------|---------------|-----------|
| `factions` | `evento_id` | `factions` | reemplazo |
| `stand_trivia` | estands del evento | `stand_trivia` | reemplazo |
| `gamification_config` | `evento_id` | `gamification_config` | reemplazo |
| `stands.zone_id` | — | lo baja la sync de mapa (Rafa) | — |
| view `stand_ranking` | `evento_id` | `ranking_cache` | reemplazo en transacción |
| view `faction_scores` | `evento_id` | `faction_score_cache` | reemplazo en transacción |

Al terminar, `local_sync_state(scope = 'gamification_ranking:<eventoId>', last_synced_at = now)`.

## Seguridad (RLS)

- `SELECT` e `INSERT` para `authenticated` en todas las tablas; `UPDATE` solo en `user_stamps` y `roulette_spins`; ninguna policy de `DELETE`.
- `xp_transactions`, `stand_ratings` y `user_achievements` no tienen policy de `UPDATE`, así que son inmutables en el servidor.
- Las views se exponen con `security_invoker = true`.
