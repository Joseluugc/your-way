# Contrato: `IRankingProjectionPort`

Puerto de consulta, de solo lectura, que expone el módulo de Gamificación para la pantalla de Ranking y el Dashboard de organización (Joselu). Está definido en `app-eventos/src/modules/gamification/application/ports/IRankingProjectionPort.ts` y su implementación por defecto es `infrastructure/sqlite/SqliteRankingProjection.ts`, que lee las cachés locales que rellena la sync.

```ts
export interface StandRankingEntry {
  standId: string;
  standName: string;
  position: number;        // 1-based
  bayesianScore: number;   // 0..5, 2 decimales
  averageStars: number | null;
  ratingCount: number;
  stampCount: number;
}

export interface FactionScore {
  factionId: string;
  name: string;
  colorHex: string;
  totalXp: number;
  memberCount: number;
}

export interface IRankingProjectionPort {
  getStandRanking(eventoId: string): Promise<StandRankingEntry[]>;
  getFactionScores(eventoId: string): Promise<FactionScore[]>;
  /** Hora de la última proyección bajada del servidor; null si nunca se ha sincronizado. */
  getLastUpdatedAt(eventoId: string): Promise<string | null>;
}
```

## Semántica

### Ranking de estands (FR-017)
- `bayesianScore = (v·R + m·C) / (v + m)`, donde `v` = número de valoraciones del estand, `R` = su media, `C` = media de todas las valoraciones del evento y `m = 5`.
- Un estand sin valoraciones tiene `bayesianScore = C` (o 0 si el evento no tiene ninguna valoración) y `averageStars = null`.
- Orden: `bayesianScore` desc → `ratingCount` desc → `standName` asc (sin distinguir mayúsculas). `position` es consecutivo, sin posiciones repetidas por empate.
- Incluye todos los estands del evento (no borrados).

### Marcador de facciones (FR-018)
- `totalXp = Σ xp_transactions.final_xp` de los miembros, atribuyendo cada transacción a `COALESCE(xp.faction_id, attendee_factions.faction_id)`.
- Incluye facciones con 0 XP. Orden: `totalXp` desc → `name` asc.

### Datos sin conexión (FR-019)
- Los métodos nunca acceden a la red: devuelven la última proyección guardada en local, combinada con los datos locales aún no sincronizados del propio dispositivo (valoraciones y XP pendientes), para que el asistente vea su aportación al momento.
- `getLastUpdatedAt` permite a la UI mostrar «Actualizado a las HH:MM».

## Origen remoto (views Supabase)

```sql
-- stand_ranking: una fila por estand con bayesian_score, average_stars, rating_count, stamp_count
-- faction_scores: una fila por facción con total_xp, member_count
```

La sync baja ambas views por `evento_id` y reemplaza `ranking_cache` / `faction_score_cache` en una transacción.
